const express = require("express");
const cors = require("cors");

require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { response } = require("express");
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// console.log(process.env.DB_USER, process.env.DB_PASS);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@atlascluster.j32tjfb.mongodb.net/?retryWrites=true&w=majority`;
// console.log(uri);

// const uri =
//   'mongodb+srv://<username>:<password>@atlascluster.j32tjfb.mongodb.net/?retryWrites=true&w=majority';

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const dbConnect = async () => {
  try {
    // await client.connect();
    console.log("Database Connected!");
  } catch (error) {
    console.log(error.name, error.message);
  }
};
dbConnect();

const coffeeCollection = client.db("coffeeDB").collection("coffee");

//! for words collection
const words = client.db("coffeeDB").collection("words");

//! for words collection
app.get("/words/words", async (req, res) => {
  const cursor = words.find();
  const result = await cursor.toArray();
  res.send(result);
});

app.get("/coffee", async (req, res) => {
  const cursor = coffeeCollection.find();
  const result = await cursor.toArray();
  res.send(result);
});

app.get("/coffee/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await coffeeCollection.findOne(query);
  res.send(result);
});

app.post("/coffee", async (req, res) => {
  const newCoffee = req.body;
  console.log(newCoffee);
  const result = await coffeeCollection.insertOne(newCoffee);
  res.send(result);
});

app.put("/coffee/:id", async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };
  const options = { upsert: true };
  const updatedCoffee = req.body;

  const coffee = {
    $set: {
      name: updatedCoffee.name,
      quantity: updatedCoffee.quantity,
      supplier: updatedCoffee.supplier,
      taste: updatedCoffee.taste,
      category: updatedCoffee.category,
      details: updatedCoffee.details,
      photo: updatedCoffee.photo,
    },
  };
  const result = await coffeeCollection.updateOne(filter, coffee, options);
  res.send(result);
});

app.delete("/coffee/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await coffeeCollection.deleteOne(query);
  res.send(result);
});

// Send a ping to confirm a successful connection
// await client.db("admin").command({ ping: 1 });
// console.log("Pinged your deployment. You successfully connected to MongoDB!");

app.get("/", (req, res) => {
  res.send("Coffee making server is running!");
});

app.listen(port, () => {
  console.log(`Coffee Server is running on port:${port}`);
});
