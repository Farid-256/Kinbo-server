require('dotenv').config()
const express = require('express');
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


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

async function run() {
    try {
        await client.connect();

        const database = client.db('kinbo_db')
        const productCollection = database.collection('products')
        const companyCollection = database.collection('company')
        const cartCollection = database.collection('cart')
        const ordersCollection = database.collection('orders')

        app.post('/api/products', async (req, res) => {
            const productData = req.body
            const result = await productCollection.insertOne(productData)
            res.send(result)
        })

        app.post('/api/my-company', async (req, res) => {
            const companyData = req.body
            const result = await companyCollection.insertOne(companyData)
            res.send(result)
        })

        app.post('/api/cart', async (req, res) => {
            const cartData = req.body

            const existing = await cartCollection.findOne({
                userId: cartData.userId,
                productId: cartData.productId
            })

            if (existing) {
                await cartCollection.updateOne(
                    { _id: existing._id },
                    {
                        $inc: {
                            quantity: cartData.quantity
                        }
                    }
                )
                return res.send({ message: 'Quantity updated' })
            }

            const result = await cartCollection.insertOne(cartData)
            res.send(result)
        })

        app.post('/api/orders', async (req, res) => {
            const ordersData = req.body
            const result = await ordersCollection.insertOne(ordersData)

            for (let item of ordersData.items) {
                await ordersCollection.updateOne(
                    { _id: new ObjectId(item._id) },
                    { $inc: { stock: -item.quantity } }
                )
            }
            res.send(result)
        })

        app.get('/api/products', async (req, res) => {
            const query = {}
            if (req.query.sellerId) {
                query.sellerId = req.query.sellerId
            }
            if (req.query.status) {
                query.status = req.query.status
            }
            const result = await productCollection.find(query).toArray()
            res.send(result)
        })

        app.get('/api/my-company', async (req, res) => {
            const { sellerId } = req.query

            if (!sellerId) {
                return res.json(null)
            }

            const result = await companyCollection.findOne({ sellerId })
            res.json(result || null)
        })

        app.get('/api/products/:id', async (req, res) => {
            const { id } = req.params
            const result = await productCollection.findOne({ _id: new ObjectId(id) })
            res.send(result)
        })

        app.get('/api/cart/:userId', async (req, res) => {
            const { userId } = req.params
            const result = await cartCollection.find({ userId }).toArray()
            res.send(result)
        })

        app.get('/api/orders', async (req, res) => {
            const query = {}
            if (req.query.userId) {
                query.userId = req.query.userId
            }

            const result = await ordersCollection.find(query).sort({ createdAt: -1 }).toArray()
            res.send(result)
        })









        await client.db('admin').command({ ping: 1 })
        console.log("MongoDB connected successfully!");
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})