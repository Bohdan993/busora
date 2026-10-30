/** @format */

const { Router } = require('express');
const {
  registration,
  activation,
  login,
  logout,
  refresh
} = require('@services/userService');

const { body, validationResult } = require('express-validator');
const AdminAPIError = require('@exeptions/admin/api-error');
const constants = require('@helpers/constants.js');
const router = Router();

/**
 * @swagger
 * /api/admin/auth/register:
 *   post:
 *     summary: Register a new admin account
 *     description: Creates a new admin user. The account must be activated via the email link before login is possible.
 *     tags: [Admin / Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 30
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 32
 *     responses:
 *       200:
 *         description: Registration successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   $ref: '#/components/schemas/OkStatus'
 *                 data:
 *                   type: object
 *                   description: New user record (without tokens — account not yet activated)
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/register',
  body('name').isLength({ min: 2, max: 30 }),
  body('email').isEmail(),
  body('password').isLength({ min: 6, max: 32 }),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw AdminAPIError.ValidationError(
          'Помилка при валідації',
          errors.array()
        );
      }
      const { email, password, name } = req?.body ?? {};
      const deviceFingerprint = req.fingerprint?.hash;
      const registrationData = await registration(
        email,
        password,
        name,
        deviceFingerprint
      );
      // res.cookie("refreshToken", registrationData?.refreshToken, {
      //     maxAge: constants.REFRESH_TOKEN_TIME,
      //     httpOnly: true,
      //     secure: true
      // });
      return res.json({
        status: 'ok',
        data: registrationData
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * @swagger
 * /api/admin/auth/login:
 *   post:
 *     summary: Admin login
 *     description: >
 *       Authenticates an admin user. Returns a short-lived `accessToken` in the response
 *       body and sets a `refreshToken` HTTP-only cookie.
 *     tags: [Admin / Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 32
 *     responses:
 *       200:
 *         description: Login successful
 *         headers:
 *           Set-Cookie:
 *             schema:
 *               type: string
 *               example: refreshToken=xxx; HttpOnly; Secure
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   $ref: '#/components/schemas/OkStatus'
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                       description: "JWT access token — pass as Authorization: Bearer <token>"
 *                     refreshToken:
 *                       type: string
 *                     user:
 *                       type: object
 *       400:
 *         description: Validation error or wrong credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/login',
  body('email').isEmail(),
  body('password').isLength({ min: 6, max: 32 }),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw AdminAPIError.ValidationError(
          'Помилка при валідації',
          errors.array()
        );
      }
      const { email, password } = req.body;
      const deviceFingerprint = req.fingerprint?.hash;
      const userData = await login(email, password, deviceFingerprint);
      res.cookie('refreshToken', userData?.refreshToken, {
        maxAge: constants.REFRESH_TOKEN_TIME,
        httpOnly: true,
        secure: true
      });
      return res.json({
        status: 'ok',
        data: userData
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * @swagger
 * /api/admin/auth/logout:
 *   get:
 *     summary: Admin logout
 *     description: Invalidates the refresh token and clears the `refreshToken` cookie.
 *     tags: [Admin / Auth]
 *     responses:
 *       200:
 *         description: Logged out
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 */
router.get('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies || {};
    const token = await logout(refreshToken);
    res.clearCookie('refreshToken');
    return res.json({
      status: 'ok'
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * @swagger
 * /api/admin/auth/activate/{link}:
 *   get:
 *     summary: Activate admin account via email link
 *     description: Activates the account and redirects to the admin login page.
 *     tags: [Admin / Auth]
 *     parameters:
 *       - in: path
 *         name: link
 *         required: true
 *         schema: { type: string }
 *         description: Activation UUID from the registration email
 *     responses:
 *       302:
 *         description: Redirects to admin login URL
 *       404:
 *         description: Invalid or expired activation link
 */
router.get('/activate/:link', async (req, res, next) => {
  try {
    const activationLink = req.params.link;
    await activation(activationLink);
    return res.redirect(process.env.ADMIN_URL + '/login');
  } catch (err) {
    return next(err);
  }
});

/**
 * @swagger
 * /api/admin/auth/refresh:
 *   get:
 *     summary: Refresh admin access token
 *     description: >
 *       Issues a new `accessToken` using the `refreshToken` HTTP-only cookie.
 *       Also rotates the refresh token.
 *     tags: [Admin / Auth]
 *     responses:
 *       200:
 *         description: New tokens issued
 *         headers:
 *           Set-Cookie:
 *             schema: { type: string }
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   $ref: '#/components/schemas/OkStatus'
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken: { type: string }
 *                     refreshToken: { type: string }
 *                     user: { type: object }
 *       401:
 *         description: Invalid or missing refresh token
 */
router.get('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies || {};
    const deviceFingerprint = req.fingerprint?.hash;
    const userData = await refresh(refreshToken, deviceFingerprint);
    res.cookie('refreshToken', userData?.refreshToken, {
      maxAge: constants.REFRESH_TOKEN_TIME,
      httpOnly: true,
      secure: true
    });
    return res.json({
      status: 'ok',
      data: userData
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
