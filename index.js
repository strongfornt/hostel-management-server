const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const app = express();
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
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
  },
});

//middleWare start ===============================================================
const verifyToken = async (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

//middleWare end ==========================================================

async function run() {
  try {
    //database collection start ========================================================
    const database = client.db("hostelDB");
    const usersCollection = database.collection("users");
    const membershipCollection = database.collection("membership");
    const paymentCollection = database.collection("payment");
    const mealsCollection = database.collection("meals");
    const upcomingMealsCollection = database.collection("upcomingMeals");
    const likesCollection = database.collection("likes");
    const reviewsCollection = database.collection("reviews");
    const mealRequestCollection = database.collection("requestedMeals")
    //database collection end ========================================================

    //jwt related api =================================================
    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "Admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });
      res.send({ token });
    });
    //=================================================================

    //users related action start ======================================================
    app.get("/users", async (req, res) => {
      const filter = req.query;
      let query = {};
      if (filter.name) {
        query.name = { $regex: filter.name, $options: "i" };
      }
      if (filter.email) {
        query.email = { $regex: filter.email, $options: "i" };
      }
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const userInfo = req.body;
      const query = { email: userInfo.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      } else {
        const result = await usersCollection.insertOne(userInfo);
        return res.send(result);
      }
    });

    app.put("/users", async (req, res) => {
      const userInfo = req.body;
      const filter = { email: userInfo?.email };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          badge: userInfo?.badge,
        },
      };

      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    app.patch("/users/:id", async (req, res) => {
      const id = req?.params?.id;
      const userInfo = req.body;
      // console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: userInfo?.role,
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    //users related action end ======================================================

    //Payment related action start===================================================
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      // console.log(amount,'amount inside the intent');
      //payment intent =====
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    //Payment related action end===================================================

    // payment collection related action start ==================================

    app.post("/payment", async (req, res) => {
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment);
      res.send(result);
    });
    // payment collection related action end ==================================

    //Membership related action api start =========================================
    app.get("/membership/:name", async (req, res) => {
      const filter = req.params.name;
      // console.log(name);
      const query = {
        name: filter,
      };
      const result = await membershipCollection.findOne(query);
      res.send(result);
    });
    //Membership related action api end =========================================

    //upcoming collection related api start ==================================================
    app.get("/upcomingMeals", async (req, res) => {
      const likes = req.query.likes;
      let sortCriteria = {};
      if (likes === "likes") {
        sortCriteria = { likes: -1 };
      }
      const result = await upcomingMealsCollection
        .find()
        .sort(sortCriteria)
        .toArray();
      res.send(result);
    });
    app.post("/upcomingMeals", async (req, res) => {
      const mealsInfo = req.body;
      const result = await upcomingMealsCollection.insertOne(mealsInfo);
      res.send(result);
    });
    //upcoming collection related api end ==================================================

    // mealsCollection related action api start ======================================
    app.get("/meal-details/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await mealsCollection.findOne(query);
      res.send(result);
    });
    app.get("/category_meals", async (req, res) => {
      const result = await mealsCollection.find().toArray();
      res.send(result);
    });
    app.get("/allMeals", async (req, res) => {
      const query = req.query.sort;

      // const order = 1;
      let sortCriteria = {};
      if (query === "likes") {
        sortCriteria = { likes: -1 }; // Sort by likes in descending order
      } else if (query === "reviews") {
        sortCriteria = { reviews: -1 }; // Sort by reviews in descending order
      }

      const result = await mealsCollection
        .find({ status: "Available" })
        .sort(sortCriteria)
        .toArray();
      res.send(result);
    });
    app.get(
      "/total_meals/:email",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        const query = { "creator.email": email };
        const mealsCount = await mealsCollection.countDocuments(query);
        res.send({ mealsCount });
      }
    );
    app.get("/meals", async (req, res) => {
      const { limit, offset, category, price, search } = req.query;
      const priceValue = parseFloat(price);
      let query = {};
      if (category) {
        query = { category: category };
      }
      if (search) {
        query = { title: { $regex: search, $options: "i" } };
      }

      if (priceValue) {
        {
          if (priceValue === 5) {
            query.price = { $lt: priceValue };
          }
          if (priceValue === 7) {
            query.price = { $gt: priceValue };
          }
        }
      }

      //limit and skip related start ========================================
      const page = parseInt(offset) || 1;
      const limits = parseInt(limit) || 4;
      const skip = (page - 1) * limit;
      //limit and skip related start ========================================

      const result = await mealsCollection
        .find(query)
        .skip(skip)
        .limit(limits)
        .toArray();
      // count the document api start ======================================
      const mealsCount = await mealsCollection.countDocuments(query);
      res.send({ result, mealsCount });
    });
    app.post("/meals/:id", async (req, res) => {
      const mealId = req.params.id;
      const mealsInfo = req.body.mealInfo;
      const status = mealsInfo?.status;
      console.log(status);
      // if specific meal   in upcoming meals collection =====================
      if (mealsInfo && status === "Available") {
        const insertResult = await mealsCollection.insertOne(mealsInfo);
        const deleteResult = await upcomingMealsCollection.deleteOne({
          _id: new ObjectId(mealId),
        });
        return res.send({ insertResult, deleteResult });
      }
      if (mealsInfo && status === "Upcoming") {
        const insertResult = await mealsCollection.insertOne(mealsInfo);
        return res.send(insertResult);
      }
      // if specific meal   in upcoming meals collection end ====================
    });
    app.put("/allMeals/:id", async (req, res) => {
      const id = req.params.id;
      const mealInfo = req.body.mealInfo;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...mealInfo,
        },
      };
      const result = await mealsCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });
    app.delete("/allMeals/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await mealsCollection.deleteOne(query);
      res.send(result);
    });
    //meal collection related action api end ======================================

    //upcomingPublic meal related work with mealsCollection and upcomingMeals collection======================
    app.get("/upcoming_public_meals", async (req, res) => {
      const result = await mealsCollection
        .find({ status: "Upcoming" })
        .toArray();
      res.send(result);
    });
    //upcomingPublic meal related work with mealsCollection and upcomingMeals collection end============

    //request meal collection related work start here ======================
      app.post('/request_meals',async(req,res)=>{
        const {requestMealInfo} = req.body;
        console.log(requestMealInfo);
      })
    //request meal collection related work start here end ======================

    //likes collection related work start here  ============================
    app.get('/likes/',async(req,res)=>{
      const info = req.query;
      const mealsArray = info?.mealsIds.split(",")
      const  mealIds = mealsArray?.map(id => id)
     
      const likes = await likesCollection.find({ mealId: { $in:mealIds } }).toArray();
      
      let likeStatus = {};
      mealsArray.forEach(id => {
          const like = likes.find(like => like.mealId.toString()=== id);
          if(like && like.userEmails.includes(info?.email)){
            likeStatus[id] = true;
          }else{
            likeStatus[id] = false;
          }
      });
      
      res.send(likeStatus)
    })

    app.post("/likes/:id", async (req, res) => {
      const id = req.params.id;
      // const query = {}
      const { email, upcomingId  } = req.body;
    
      const existingLike = await likesCollection.findOne({ mealId: id });
      if (existingLike) {
        const emailIndex = existingLike.userEmails.indexOf(email);

        if (emailIndex > -1) {
          await likesCollection.updateOne(
            { mealId: id },
            { $pull: { userEmails: email } }
          );
          await mealsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $inc: { likes: -1 } }
          );
          await upcomingMealsCollection.updateOne(
            { _id: new ObjectId(upcomingId) },
            { $inc: { likes: -1 } }
          );

          return res.send({ message: false });
        } else{
          await likesCollection.updateOne(
            { mealId: id },
            { $push: { userEmails: email } }
          );
          await mealsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $inc: { likes: 1 } }
          );
          await upcomingMealsCollection.updateOne(
            { _id: new ObjectId(upcomingId) },
            { $inc: { likes: 1 } }
          );
          // return res.send({message:true})
        }
      }else{
        await likesCollection.insertOne({
          mealId: id,
          userEmails: [email],
        });
        await mealsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $inc: { likes: 1 } }
        );
        await upcomingMealsCollection.updateOne(
          { _id: new ObjectId(upcomingId) },
          { $inc: { likes: 1 } }
        );
        // return res.send({message:true})
      }

      const upcomingTrack = await upcomingMealsCollection.findOne({_id: new ObjectId(upcomingId)})
      const mealsTrack = await mealsCollection.findOne({_id: new ObjectId(id)})
        
      if(upcomingTrack.likes >= 10 && mealsTrack.likes >= 10 ){
        await upcomingMealsCollection.deleteOne({_id: new ObjectId(upcomingId)})
        await mealsCollection.updateOne(
          {_id: new ObjectId(id)},
          { $set: {status: 'Available'}}
        )
      }

      return res.send({ message: true ,totalLikes: mealsTrack.likes});
      

    });
    app.post("/likes_available_meals/:id", async (req, res) => {
      const id = req.params.id;
      // const query = {}
      const { email } = req.body;
    
      const existingLike = await likesCollection.findOne({ mealId: id });
      if (existingLike) {
        const emailIndex = existingLike.userEmails.indexOf(email);

        if (emailIndex > -1) {
          await likesCollection.updateOne(
            { mealId: id },
            { $pull: { userEmails: email } }
          );
          await mealsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $inc: { likes: -1 } }
          );
          // await upcomingMealsCollection.updateOne(
          //   { _id: new ObjectId(upcomingId) },
          //   { $inc: { likes: -1 } }
          // );

          return res.send({ message: false });
        } else{
          await likesCollection.updateOne(
            { mealId: id },
            { $push: { userEmails: email } }
          );
          await mealsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $inc: { likes: 1 } }
          );
          // await upcomingMealsCollection.updateOne(
          //   { _id: new ObjectId(upcomingId) },
          //   { $inc: { likes: 1 } }
          // );
          // return res.send({message:true})
        }
      }else{
        await likesCollection.insertOne({
          mealId: id,
          userEmails: [email],
        });
        await mealsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $inc: { likes: 1 } }
        );
        // await upcomingMealsCollection.updateOne(
        //   { _id: new ObjectId(upcomingId) },
        //   { $inc: { likes: 1 } }
        // );
        // return res.send({message:true})
      }

    

      return res.send({ message: true });
      

    });
    //likes collection related work end here  ============================

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", async (req, res) => {
  res.send("server running");
});

app.listen(port, () => {
  console.log(`server running on port ${port}`);
});
