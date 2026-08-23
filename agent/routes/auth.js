const jwt = require('jsonwebtoken');
const express = require('express');
const router = express.Router();
const { COOKIE_SECURE } = require('../config');

router.post('/login', (req,res)=>{
    if (process.env.PASSWORD === req.body.password){
        const token = jwt.sign({authorized:true}, process.env.JWT_SECRET, {expiresIn:'7d'})
        res.cookie('token',token, {httpOnly: true, secure: COOKIE_SECURE})
        res.json({success: true})
    } 
    else{
        return res.status(401).json({error: 'Invalid password'})
    }
})

router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
});

module.exports = router