require('dotenv').config()
const express = require('express');
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { createRemoteJWKSet, jwtVerify } = require('jose');


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
})

const JWKS = createRemoteJWKSet(
    new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
)

const verifyToken = async (req, res, next) => {
    const authHeader = req?.headers.authorization
    if (!authHeader) {
        return res.status((401)).json({ message: 'Unauthorization' })
    }
    const token = authHeader.split(' ')[1]
    if (!token) {
        return res.status((401)).json({ message: 'Unauthorization' })
    }

    try {
        const { payload } = await jwtVerify(token, JWKS)
        next()
    } catch (error) {
        return res.status(403).json({ message: "Forbidden" })
    }


}

async function run() {
    try {
        // await client.connect();

        const database = client.db('kinbo_db')
        const productCollection = database.collection('products')
        const companyCollection = database.collection('company')
        const cartCollection = database.collection('cart')
        const ordersCollection = database.collection('orders')
        const sellerRequestsCollection = database.collection('sellerRequests')
        const bannerCollection = database.collection('banners')


        app.post('/api/products', verifyToken, async (req, res) => {
            const productData = req.body
            const result = await productCollection.insertOne(productData)
            res.send(result)
        })

        app.post('/api/my-company', verifyToken, async (req, res) => {
            const companyData = req.body

            const result = await companyCollection.updateOne(
                { sellerId: companyData.sellerId },
                { $set: companyData },
                { upsert: true }
            )
            res.send(result)
        })
        app.post('/api/cart', verifyToken, async (req, res) => {
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

        app.post('/api/orders', verifyToken, async (req, res) => {
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
        app.post('/api/seller-requests', verifyToken, async (req, res) => {
            const sellerRequest = req.body
            const result = await sellerRequestsCollection.insertOne(sellerRequest)
            res.send(result)
        })

        app.post('/api/banner', verifyToken, async (req, res) => {
            try {
                const bannerData = req.body

                const result = await bannerCollection.updateOne(
                    {},
                    { $set: bannerData },
                    { upsert: true }
                )
                res.send(result)
            } catch (error) {
                console.error(error)
                res.status(500).send({ message: 'Failed to save banner' })
            }
        })
















        app.get('/api/my-company', async (req, res) => {
            const { sellerId } = req.query

            if (!sellerId) {
                return res.json(null)
            }

            const result = await companyCollection.findOne({ sellerId })
            res.json(result || null)
        })

        //Details page api
        app.get('/api/products/:id', verifyToken, async (req, res) => {
            const { id } = req.params
            const result = await productCollection.findOne({ _id: new ObjectId(id) })
            res.send(result)
        })

        app.get('/api/cart/:userId', verifyToken, async (req, res) => {
            const { userId } = req.params
            const result = await cartCollection.find({ userId }).toArray()
            res.send(result)
        })

        app.get('/api/orders', verifyToken, async (req, res) => {
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
        app.get('/api/seller-requests/check', verifyToken, async (req, res) => {
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
        app.get('/api/seller-requests', verifyToken, async (req, res) => {
            try {
                const result = await sellerRequestsCollection.find().sort({ createdAt: -1 }).toArray()
                res.send(result)
            } catch (error) {
                console.error(error)
                res.status(500).send({ message: 'Failed to fetch requests' })
            }
        })

        app.get('/api/banner', verifyToken, async (req, res) => {
            try {
                const result = await bannerCollection.findOne()
                res.json(result || null)
            } catch (error) {
                console.error(error)
                res.status(500).json(null)
            }
        })

        //admin company delete api
        app.get('/api/companies', async (req, res) => {
            const result = await companyCollection.find().sort({ createdAt: -1 }).toArray()
            res.send(result)
        })

        //pagination
        app.get('/api/products', async (req, res) => {
            try {
                const query = {}

                if (req.query.sellerId) {
                    query.sellerId = req.query.sellerId
                }

                if (req.query.status) {
                    query.status = req.query.status
                }

                const page = Math.max(1, parseInt(req.query.page) || 1)
                const limit = Math.max(1, parseInt(req.query.limit) || 32)
                const skip = (page - 1) * limit

                const totalProducts = await productCollection.countDocuments(query)

                const products = await productCollection
                    .find(query)
                    .skip(skip)
                    .limit(limit)
                    .toArray()

                res.send({
                    products,
                    currentPage: page,
                    totalPages: Math.ceil(totalProducts / limit),
                    totalProducts
                })
            } catch (error) {
                console.error(error)
                res.status(500).send({ message: 'Failed to fetch products' })
            }
        })







        //done
        app.patch('/api/orders/:id', verifyToken, async (req, res) => {
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
        app.patch('/api/seller-requests/:id', verifyToken, async (req, res) => {
            try {
                const { id } = req.params
                const { status } = req.body

                // Request update
                const result = await sellerRequestsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status } }
                )

                // If approved, update the user's role.
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

        //update api
        app.patch('/api/products/:id', verifyToken, async (req, res) => {
            const { id } = req.params
            const updateData = req.body

            const result = await productCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: updateData }
            )
            res.send(result)
        })








        app.delete('/api/product/:id', verifyToken, async (req, res) => {
            const { id } = req.params
            const result = await productCollection.deleteOne({ _id: new ObjectId(id) })
            res.send(result)
        })

        app.delete('/api/cart/:id', verifyToken, async (req, res) => {
            const { id } = req.params
            const result = await cartCollection.deleteOne({ _id: new ObjectId(id) })
            res.send(result)
        })

        app.delete('/api/cart/user/:userId', verifyToken, async (req, res) => {
            const { userId } = req.params
            const result = await cartCollection.deleteMany({ userId })
            res.send(result)
        })

        //admin company delete api
        app.delete('/api/companies/:id', verifyToken, async (req, res) => {
            try {
                const { id } = req.params


                const company = await companyCollection.findOne({ _id: new ObjectId(id) })
                if (!company) {
                    return res.status(404).send({ message: 'Company not found' })
                }


                const result = await companyCollection.deleteOne({ _id: new ObjectId(id) })


                const productResult = await productCollection.deleteMany({ sellerId: company.sellerId })


                const cartResult = await cartCollection.deleteMany({ userId: company.sellerId })


                res.send({
                    companyDeleted: result.deletedCount,
                    productsDeleted: productResult.deletedCount,
                    cartItemsDeleted: cartResult.deletedCount
                })
            } catch (error) {
                console.error(error)
                res.status(500).send({ message: 'Failed to delete company' })
            }
        })









        // await client.db('admin').command({ ping: 1 })
        // console.log("MongoDB connected successfully!");
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})