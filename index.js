require('dotenv').config()
const express = require('express');
const cors = require('cors')
const { MongoClient, ServerApiVersion } = require('mongodb');


const app = express()
const port = process.env.PORT || 5000
const uri = process.env.MONGODB_URI


app.use(cors())
app.use(express.json())

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

app.get('/', (req, res) => {
  res.send('Hello World!')
})



async function run() {
    try {
        await client.connect();
        const database = client.db('kinbo_db')
        const productCollection = database.collection('products')
        

        app.post('/api/products', async (req, res) => {
            const productData = req.body
            const result = await productCollection.insertOne(productData)
            res.send(result)
        })







        await client.db('admin').command({ping: 1})
        console.log("MongoDB connected successfully!");
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})