const jwt = require('jsonwebtoken');

const mutations = {
    async signup(parent, args, ctx, info) {
        const user = await ctx.db.mutation.createUser(
            {
                data: {
                    name: 'KR',
                    accessToken: '234',
                },
            },
            info
        );

        const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
        // We set the jwt as a cookie on the response
        ctx.response.cookie('token', token, {
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year cookie
        });

        console.log('>>>', user, token);

        return user;
    },
    signout(parent, args, ctx, info) {
        console.log('comes here');

        ctx.response.clearCookie('token');
        // return { message: 'Goodbye!' }
        return "something";
    },
};

module.exports = mutations;
