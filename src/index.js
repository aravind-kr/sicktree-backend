const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
// const express = require("express");
const next = require('next');
const rp = require('request-promise');

require('dotenv').config({ path: 'variables.env' });
const createServer = require('./createServer');
const db = require('./db');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const server = createServer();

server.express.use(cookieParser());

// /dashboard  -> access
// app.prepare().then(() => {
//   const server = express();

//   server.get("/dashboard", (req, res) => {
//     return app.render(req, res, "/dashboard", req.query);
//   });

//   server.get("*", (req, res) => {
//     return handle(req, res);
//   });

//   server.listen(3000, err => {
//     if (err) throw err;
//     console.log("> Ready on http://localhost:3000");
//   });
// });

// decode the JWT so we can get the user Id on each request
server.express.use((req, res, next) => {
    const { token } = req.cookies;
    if (token) {
        const { userId } = jwt.verify(token, process.env.APP_SECRET);
        
        // put the userId onto the req for future requests to access
        req.userId = userId;
    }
    next();
});

// 2. Create a middleware that populates the user on each request

server.express.use(async (req, res, next) => {
    // if they aren't logged in, skip this
    if (!req.userId) return next();
    try {
        const user = await db.query.user(
            { where: { id: req.userId } },
            '{ id, username }'
        );
        req.user = user;
    } catch (error) {
        console.log('>>> ', error);
    }
    next();
});

server.express.get('/dashboard', async (req, res) => {
    try {
        const options = {
            method: 'POST',
            uri: 'https://api.instagram.com/oauth/access_token',
            formData: {
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                grant_type: 'authorization_code',
                redirect_uri: process.env.REDIRECT_URL,
                code: req.query.code,
            },
            json: true,
        };

        let result = await rp(options);

        const user = await db.mutation.upsertUser(
            {
                where: {
                    username: result.user.username,
                },
                create: {
                    access_token: result.access_token,
                    username: result.user.username,
                    profile_picture: result.user.profile_picture,
                    full_name: result.user.full_name,
                    bio: result.user.bio,
                    is_business: result.user.is_business,
                    website: result.user.website,
                },
                update: {
                  access_token: result.access_token,
                  profile_picture: result.user.profile_picture,
                  full_name: result.user.full_name,
                  bio: result.user.bio,
                  is_business: result.user.is_business,
                  website: result.user.website,
              },
            },
            '{ id, username }'
        );

        const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);

        res.cookie('token', token, {
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year cookie
        });

        res.redirect('http://localhost:7777/dashboard');
    } catch (error) {
        console.log(error);
    }

    // app.render('/test')
});

server.start(
    {
        cors: {
            credentials: true,
            origin: process.env.FRONTEND_URL,
        },
    },
    deets => {
        console.log(
            `Server is now running on port http://localhost:${deets.port}`
        );
    }
);
