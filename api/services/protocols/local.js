/* global AuthService, EmailTemplateService, Passport, User, UserService */

/**
 * Local Authentication Protocol
 *
 * The most widely used way for websites to authenticate users is via a username
 * and/or email as well as a password. This module provides functions both for
 * registering entirely new users, assigning passwords to already registered
 * users and validating login requesting.
 *
 * For more information on local authentication in Passport.js, check out:
 * http://passportjs.org/guide/username-password/
 */

/**
 * Register a new user
 *
 * This method creates a new user from a specified email, username and password
 * and assign the newly created user a local Passport.
 *
 * @param {Object}   req
 * @param {Object}   res
 * @param {Function} next
 */
exports.register = async function (req, res, next) {
    var email    = req.param("email");
    var username = req.param("username");
    var password = req.param("password");

    try {
        const user = UserService.createUser({
            email,
            username,
            password,
        }, {
            passwordRequired: true,
            req,
            res,
        });

        var token = await User.createCheckEmailToken(user, user.email);

        EmailTemplateService
            .sendEmailTemplate('app-subscription-to-confirm', {
                user: user,
                token: token
            })
            .catch(() => { /* do nothing*/ });

        next(null, user);
    } catch (err) {
        next(err);
    }
};

/**
 * Assign local Passport to user
 *
 * This function can be used to assign a local Passport to a user who doens't
 * have one already. This would be the case if the user registered using a
 * third-party service and therefore never set a password.
 *
 * @param {Object}   req
 * @param {Object}   res
 * @param {Function} next
 */
exports.connect = async function (req, res, next) {
    var user     = req.user;
    var password = req.param("password");

    try {
        await AuthService.addPasswordAuth({ userId: user.id, password });
        next(null, user);
    } catch (err) {
        next(err);
    }
};

/**
 * Validate a login request
 *
 * Looks up a user using the supplied identifier (email or username) and then
 * attempts to find a local Passport associated with the user. If a Passport is
 * found, its password is checked against the password supplied in the form.
 *
 * @param {Object}   req
 * @param {string}   identifier
 * @param {string}   password
 * @param {Function} next
 */
exports.login = async function (req, identifier, password, next) {
    var isEmail = µ.isEmail(identifier);

    try {
        if (!isEmail) {
            throw new BadRequestError("email incorrect");
        }

        const user = await User.findOne({ email: identifier });
        if (!user) {
            throw new NotFoundError("user not found");
        }

        const passport = await Passport.findOne({
            protocol: 'local',
            user: user.id,
        });
        if (!passport) {
            throw new BadRequestError("no password");
        }

        const valid = await passport.validatePassword(password);
        if (!valid) {
            throw new BadRequestError("password incorrect");
        }

        next(null, user);
    } catch (err) {
        next(err);
    }
};
