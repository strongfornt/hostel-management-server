const express = require("express");
const { MongoClient, ServerApiVersion } = require('mongodb');
const cors = require("cors");
const app = express();
require("dotenv").config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


//mongo start =====================


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.v2tnkbl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
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
    //database collection start ========================================================
    const database = client.db("hostelDB");
    const usersCollection = database.collection("users")
    //database collection end ========================================================

    //users related action start ======================================================
    app.post('/users',async(req,res) =>{
        const userInfo = req.body;
        const query = {email:userInfo.email}
        const existingUser = await usersCollection.findOne(query);
        if(existingUser){
          return res.send({message:'user already exists',insertedId:null})
        }
        const result = await usersCollection.insertOne(userInfo)
        res.send(result)
    })
    //users related action end ======================================================
    
    //Payment related action start===================================================
    app.post('/create-payment-intent',async(req,res)=>{
        const {price} = req.body;
        const amount = parseInt(price * 100);
        console.log(amount,'amount inside the intent');
        //payment intent =====
        const paymentIntent= await stripe.paymentIntents.create({
            amount,
            currency: "usd",
            payment_method_types: ['card'],
        })
        res.send({
            clientSecret: paymentIntent.client_secret,
        })
    })
    //Payment related action end===================================================

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/',async(req,res)=>{
    res.send('server running')
})

app.listen(port, () => {
    console.log(`server running on port ${port}`);
  });