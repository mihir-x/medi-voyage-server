const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')


const app = express()
const port = process.env.PORT || 5000


//middleware
app.use(express.json())
app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true,
}))
app.use(cookieParser())

//verify token middleware
const verifyToken = async(req, res, next) =>{
    const token = req.cookies?.token
    if(!token){
        return res.status(401).send({message: 'Invalid Authorization'})
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) =>{
        if(err){
            return res.status(401).send({message: 'Invalid Authorization'})
        }
        req.user = decoded
        next()
    })
}



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

    const usersCollection = client.db('mediVoyageDB').collection('users')
    const campsCollection = client.db('mediVoyageDB').collection('camps')

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
    app.get('/jwt/logout', async(req, res) =>{
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

    //users related api-----------------------------
    //save user info into database
    app.post('/users', async(req, res) =>{
        const user = req.body
        const query = {email: user.email}
        const isExists = await usersCollection.findOne(query)
        if(isExists){
            return res.send({message: 'User already exists in database', insertedId: null})
        }
        const result = await usersCollection.insertOne(user)
        res.send(result)
    })
    //get user role
    app.get('/user/:email', async(req, res) =>{
        const email = req.params.email
        const query = {email: email}
        const result = await usersCollection.findOne(query)
        res.send(result)
    })
    //update user data
    app.patch('/users/:email', async(req, res) =>{
        const email = req.params.email
        const query = {email: email}
        const {name, phone, photo} = req.body
        const updateDoc = {
            $set:{
                name: name,
                phone: phone,
                photo: photo,
            }
        }
        const result = await usersCollection.updateOne(query, updateDoc)
        res.send(result)
    })

    //camp related api---------------------------------
    //get all camps
    app.get('/camps', async(req, res) =>{
        const result = await campsCollection.find().toArray()
        res.send(result)
    })
    //get specific camps
    app.get('/camps/:id', async(req, res) =>{
        const id = req.params.id
        const query = {_id: new ObjectId(id)}
        const result = await campsCollection.findOne(query)
        res.send(result)
    })
    //add camp api
    app.post('/camps', verifyToken, async(req, res) =>{
        const item = req.body
        const result = await campsCollection.insertOne(item)
        res.send(result)
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
