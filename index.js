const express = require("express");
const { MongoClient, ServerApiVersion } = require('mongodb');
const cors = require("cors");

const app = express();
require("dotenv").config();
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
    
    const database = client.db("hostelDB");
    const userCollection = database.collection("users")
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