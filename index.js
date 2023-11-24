const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')


const app = express()
const port = process.env.PORT || 5000


//middleware
app.use(express.json())
app.use(cors())
app.use(cookieParser())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.5hh1tg8.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    //auth related api
    app.post('/jwt', async(req, res) =>{
        const user = req.body
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '2h'})
        res.cookie('token', token, {
            httpOnly: true, 
            secure: true,
            sameSite: 'none',
        }).send({success: true})
    })
    //logout api
    app.post('/jwt/logout', async(req, res) =>{
        try{
            res.clearCookie('token', {
                maxAge: 0,
                secure: true,
                sameSite: 'none',
            }).send({success: true})
        }
        catch(err){
            res.status(500).send(err)
        }
    })



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res)=>{
    res.send('Medical camp server is running')
})
app.listen(port, (req, res) =>{
    console.log(`Medical camp server is running on port ${port}`)
})
