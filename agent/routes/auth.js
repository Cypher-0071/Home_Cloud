const jwt = require('jsonwebtoken');
const express = require('express');
const router = express.Router();
const { COOKIE_SECURE } = require('../config');

router.post('/login', (req, res) => {
    if (process.env.PASSWORD && process.env.PASSWORD === req.body.password) {
        const token = jwt.sign({ authorized: true }, process.env.JWT_SECRET, { expiresIn: '7d' });
        const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
        res.cookie('token', token, {
            httpOnly: true,
            secure: isHttps && COOKIE_SECURE,
            sameSite: 'lax',
        });
        res.json({ success: true });
    } else {
        return res.status(401).json({ error: 'Invalid password' });
    }
});

router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
});

router.get('/me', (req, res) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, decodedtoken) => {
        if (err) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        res.json({ authorized: true, user: decodedtoken });
    });
});

module.exports = router;