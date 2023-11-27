const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
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
    const participationCollection = client.db('mediVoyageDB').collection('participation')
    const paymentCollection = client.db('mediVoyageDB').collection('payment')
    const reviewCollection = client.db('mediVoyageDB').collection('review')

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

    //users related api--------------------------------------------------------------
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

    //camp related api-----------------------------------------------------------------
    //get all camps
    app.get('/camps', async(req, res) =>{
        const result = await campsCollection.find().toArray()
        res.send(result)
    })
    //get popular camps
    app.get('/camps/popular', async(req, res) =>{
        const result = await campsCollection.find().sort({participant: -1}).limit(6).toArray()
        res.send(result)
    })
    //get specific camps
    app.get('/camps/:id', async(req, res) =>{
        const id = req.params.id
        const query = {_id: new ObjectId(id)}
        const result = await campsCollection.findOne(query)
        res.send(result)
    })
    //get organizer camps
    app.get('/camps/myCamps/:email', async(req, res) =>{
        const email = req.params.email
        const query = {organizer:email}
        const result = await campsCollection.find(query).toArray()
        res.send(result)
    })
    //add camp into database
    app.post('/camps', verifyToken, async(req, res) =>{
        const item = req.body
        const result = await campsCollection.insertOne(item)
        res.send(result)
    })
    //increment participant count in camp data
    app.patch('/camps/:id', async(req, res) =>{
        const id = req.params.id
        const {participant} = req.body
        if(typeof participant!== 'number' || participant<0){
            return res.status(400).send({message: 'Invalid participant count'})
        }
        const query = {_id: new ObjectId(id)}
        const result = await campsCollection.updateOne(query, {
            $inc: { participant: participant}
        })
        res.send(result)
    })
    //decrement participant count in camp data
    app.patch('/camps/decrement/:id', async(req, res) =>{
        const id = req.params.id
        const {participant} = req.body
        if(typeof participant!== 'number' || participant<0){
            return res.status(400).send({message: 'Invalid participant count'})
        }
        const query = {_id: new ObjectId(id)}
        const result = await campsCollection.updateOne(query, {
            $inc: { participant: -1}
        })
        res.send(result)
    })
    //update camp data
    app.put('/update-camp/:id', async(req, res) =>{
        const id = req.params.id
        const camp = req.body
        const query = { _id: new ObjectId(id)}
        const options = {upsert: true}
        const updateDoc = {
            $set:{
                ...camp
            }
        }
        const result = await campsCollection.updateOne(query, updateDoc, options)
        res.send(result)
    })
    //delete camp
    app.delete('/delete-camp/:id', async(req, res) =>{
        const id = req.params.id
        const query = {_id: new ObjectId(id)}
        const result = await campsCollection.deleteOne(query)
        res.send(result)
    })

    //participation related api---------------------------------------------------------
    //get participated camps of a organizer
    app.get('/participation/:email', async(req,res)=>{
        const email = req.params.email
        const query = {organizer: email}
        const result = await participationCollection.find(query).toArray()
        res.send(result)
    })
    //get registered camps of a participant
    app.get('/participation/participant/:email', async(req,res)=>{
        const email = req.params.email
        const query = {participant: email}
        const result = await participationCollection.find(query).toArray()
        res.send(result)
    })
    //get confirmed camps of a participant
    app.get('/participation/confirmed/:email', async(req, res)=>{
        const email = req.params.email
        const query = {
            participant: email,
            approval: 'Confirmed',
        }
        const result = await participationCollection.find(query).toArray()
        res.send(result)
    })
    //save participated camp in database
    app.post('/participation', async(req, res) =>{
        const registeredCamp = req.body
        const query = {participant: registeredCamp.participant, campId: registeredCamp.campId}
        const isExists = await participationCollection.findOne(query)
        if(isExists){
            return res.status(409).send({message: 'You have already registered for this camp'})
        }
        const result = await participationCollection.insertOne(registeredCamp)
        res.send(result)
    })
    //participation confirmation api
    app.patch('/participation/confirm/:id', async(req, res) =>{
        const id = req.params.id
        const participationQuery = {
            _id: new ObjectId(id)
        }
        const paymentQuery = {
            registerId: id
        }
        const updateApproval ={
            $set: {
                approval: 'Confirmed'
            }
        }
        const registerApproval = await participationCollection.updateOne(participationQuery, updateApproval)
        const paymentApproval = await paymentCollection.updateOne(paymentQuery, updateApproval)
        
        res.send({registerApproval, paymentApproval})
    })
    //delete participation from database
    app.delete('/participation/delete/:id', async(req, res) =>{
        const id = req.params.id
        const query = {_id: new ObjectId(id)}
        const result = await participationCollection.deleteOne(query)
        res.send(result)
    })

    //review related api-------------------------------------------------
    app.post('/review', async(req, res) =>{
        const review = req.body
        const result = await reviewCollection.insertOne(review)
        res.send(result)
    })


    //payment intent(generate payment secret for client)
    app.post('/create-payment-intent', async(req, res) =>{
        const {price} = req.body
        const amount = parseInt(price*100)
        if(!price || amount<1){
            return
        }
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'usd',
            payment_method_types: ['card'],
        })
        res.send({
            clientSecret: paymentIntent.client_secret
        })
    })
    //save payment and update registered payment status
    app.put('/payment/:id', async(req, res) =>{
        const id = req.params.id
        const paymentInfo = req.body
        const savePayment = await paymentCollection.insertOne(paymentInfo)
        const query = {
            _id: new ObjectId(id)
        }
        const updateDoc ={
            $set:{
                payment: 'Paid'
            }
        }
        const updatePayment = await participationCollection.updateOne(query,updateDoc)
        res.send({savePayment, updatePayment})
    })

    //get paid camp data for a user
    app.get('/paid-camp/:email', async(req, res)=>{
        const email = req.params.email
        const query = {
            email: email,
            payment: 'Paid',
        }
        const result = await paymentCollection.find(query).toArray()
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
