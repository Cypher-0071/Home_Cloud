const Docker = require('dockerode');
const docker = new Docker();
const express = require('express')
const router = express.Router();

const portBindings = {
    '8000/tcp' : [{HostPort: '3000'}]
};

router.get('/containers', async (req,res) =>{
    try{
        const containers = await docker.listContainers({all: true})
        res.json({containers})
    }catch(err){
        return res.status(500).json({error:err.message})
    }
})

router.post('/containers/:id/start', async (req, res) =>{
    const container = docker.getContainer(req.params.id)

    try {
        await container.start()
        res.json({success: true})
    } catch (err) {
        return res.status(500).json({error: err.message})
    }
})

module.exports = router;