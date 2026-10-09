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
        const sellerRequestsCollection = database.collection('sellerRequests')
        


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
                await productCollection.updateOne(
                    { _id: new ObjectId(item.productId) },
                    { $inc: { stock: - item.quantity } }
                )
            }
            res.send(result)
        })

        // POST  customer send request
        app.post('/api/seller-requests', async(req, res) =>{
            const sellerRequest = req.body
            const result = await sellerRequestsCollection.insertOne(sellerRequest)
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

        app.get('/api/orders', async (req, res) => {
            const query = {}
            if (req.query.userId) {
                query.userId = req.query.userId
            }
            if (req.query.sellerId) {
                query['items.sellerId'] = req.query.sellerId
            }
            const result = await ordersCollection.find(query).sort({ createdAt: -1 }).toArray()
            res.send(result)
        })

        // GET check — is already requested
        app.get('/api/seller-requests/check', async (req, res) => {
            try {
                const { userId } = req.query
                if (!userId) return res.json(null)

                const result = await sellerRequestsCollection.findOne({ userId })
                res.json(result || null)   // json(null) — valid JSON
            } catch (error) {
                console.error(error)
                res.status(500).json(null)
            }
        })

        // All seller requests (admin)
        app.get('/api/seller-requests', async (req, res) => {
            try {
                const result = await sellerRequestsCollection.find().sort({ createdAt: -1 }).toArray()
                res.send(result)
            } catch (error) {
                console.error(error)
                res.status(500).send({ message: 'Failed to fetch requests' })
            }
        })








        app.patch('/api/orders/:id', async (req, res) => {
            const { id } = req.params
            const { status } = req.body

            try {
                const result = await ordersCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status } }
                )
                res.send(result)
            } catch (error) {
                console.error(error)
                res.status(500).send({ message: 'Failed to update order' })
            }
        })

        // Approve / Reject (admin)
        app.patch('/api/seller-requests/:id', async (req, res) => {
            try {
                const { id } = req.params
                const { status } = req.body

                // ১. Request update
                const result = await sellerRequestsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status } }
                )

                // ২. If approved, update the user's role.
                if (status === 'approved') {
                    const request = await sellerRequestsCollection.findOne({ _id: new ObjectId(id) })

                    // Update the user collection in Better Auth.
                    const userCollection = database.collection('user')
                    await userCollection.updateOne(
                        { _id: new ObjectId(request.userId) },
                        { $set: { role: 'business' } }
                    )
                }

                res.send(result)
            } catch (error) {
                console.error(error)
                res.status(500).send({ message: 'Failed to update request' })
            }
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