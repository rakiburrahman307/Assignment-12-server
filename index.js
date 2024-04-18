const express = require('express');
require('dotenv').config()
const axios = require('axios')
const { NagadGateway } = require('nagad-payment-gateway');
const globals = require('node-global-storage')
const { v4: uuidv4 } = require('uuid')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const SSLCommerzPayment = require('sslcommerz-lts')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const jwt = require('jsonwebtoken');
var cookieParser = require('cookie-parser')
const app = express();
const port = process.env.PORT || 5000;



const store_id = 'testi65faa225780a1'
const store_passwd = 'testi65faa225780a1@ssl'
const is_live = false
// Middle Ware
app.use(express.json());
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5000', 'https://relaxed-puffpuff-31caad.netlify.app'],
    credentials: true,
}));

app.use(cookieParser());
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    next();
});


// Middle Ware api


const verifyToken = (req, res, next) => {
    const token = req?.cookies?.token;
    if (!token) {
        return res.status(401).send({ message: 'Unauthorized access' })
    } else {
        jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
            if (err) {
                return res.status(err).send({ message: 'Unauthorized access' });
            } else {
                req.user = decoded;
                next();
            }
        });

    }
};
const config = {
    apiVersion: 'development',
    baseURL: 'http://sandbox.mynagad.com:10060/check-out/MDYyODAwNTcyNTYxNi42ODMwMDIwMDcxMDQyMjUuOU5PTEFVNkVaWkdUWVRBLmJiZGMyNTE3MTVmZTNiNjIzN2Zk',
    callbackURL: 'https://example.com/payment/success/id=4',
    merchantID: '6800000025',
    merchantNumber: '016XXXXXXXX',
    isPath: true,
};
const nagad = new NagadGateway(config);

const bkashAuth = async (req, res, next) => {

    globals.unset('id_token')

    try {
        const { data } = await axios.post(process?.env?.bkash_grant_token_url, {
            app_key: process?.env?.bkash_api_key,
            app_secret: process?.env.bkash_secret_key,
        }, {
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                username: process?.env?.bkash_username,
                password: process?.env?.bkash_password,
            }
        })

        globals.set('id_token', data?.id_token, { protected: true })

        next()
    } catch (error) {
        return res.status(401).send({ error: error?.message })
    }
}

const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.USER_PASS}@cluster0.044ysfk.mongodb.net/?retryWrites=true&w=majority`;

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

        // Database and Collection 
        const mealsCollections = client.db('hostel_management').collection('all_meals');
        const upcomingMealsCollections = client.db('hostel_management').collection('upcoming');
        const userCollections = client.db('hostel_management').collection('users');
        const paymentType = client.db('hostel_management').collection('payment_type');
        const perchesPlanUsers = client.db('hostel_management').collection('perches_Plan_Users');
        const requestMealsCollections = client.db('hostel_management').collection('request_meals');
        const reviewCollections = client.db('hostel_management').collection('review');



        // Authentication related api 
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '24h' })

            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: true,
                    sameSite: 'none'
                })
                .send({ success: true });
        });


        app.post('/logout', async (req, res) => {
            const user = req.body;
            res
                .clearCookie('token', { maxAge: 0 })
                .send({ success: true });
        })

        // admin related api middlewares
        // use verify admin after verifyToken
        const verifyAdmin = async (req, res, next) => {
            const email = req?.user;
            const query = { email: email };
            const user = await userCollections.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' });
            } else {
                next();
            }

        }
        // checking user admin or not 
        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req?.user?.email) {
                return res.status(403).send({ message: 'forbidden access' })
            } else {
                const query = { email: email };
                const user = await userCollections.findOne(query);
                let admin = false;
                if (user) {
                    admin = user?.role === 'admin';
                }
                res.send({ admin });
            }
        })

        // Service Apis 
        // Get the all Of meals 
        app.get('/all_meals', async (req, res) => {
            const cursor = mealsCollections.find();
            const result = await cursor.toArray();
            res.send(result);
        });
        app.patch('/update_meal/:id', verifyToken, async (req, res) => {
            const id = req?.params?.id;
            const info = req?.body;
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    mealType: info?.mealType,
                    mealTitle: info?.mealTitle,
                    mealImage: info?.mealImage,
                    ingredients: info?.ingredients,
                    mealDescription: info?.mealDescription,
                    price: info?.price,
                    rating: info?.rating,
                    adminName: info?.adminName,
                    gmail: info?.gmail,
                    postTime: info?.postTime,
                }
            }
            const result = await mealsCollections.updateOne(query, updateDoc);
            res.send(result);
        });
        app.get('/all_meals/pagination', verifyToken, async (req, res) => {
            const page = parseInt(req.query.page);
            const size = parseInt(req.query.size);
            const cursor = mealsCollections.find()
                .skip(page * size)
                .limit(size)
            const result = await cursor.toArray();
            res.send(result);
        });
        app.get('/all_meals/infinite-scroll', async (req, res) => {
            const { page = 1, pageSize = 10 } = req.query;
            const skip = (page - 1) * pageSize;
            try {
                const meals = await mealsCollections.find().skip(skip).limit(pageSize).toArray();
                res.send(meals);
            } catch (error) {
                console.error('Error fetching meals for infinite scroll:', error);
                res.status(500).send({ message: 'Internal server error' });
            }
        });
        app.delete('/allMeal/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await mealsCollections.deleteOne(query);
            res.send(result);
        });
        app.post('/publishMeal', verifyToken, async (req, res) => {
            const mealData = req.body;
            const result = await mealsCollections.insertOne(mealData);
            res.send(result);
        });
        app.get('/all_meals/filter', async (req, res) => {
            const { category, minPrice, maxPrice } = req.query;
            const filter = {};

            if (category) {
                filter.mealType = category;
            }

            if (minPrice && maxPrice) {
                filter.price = { $gte: parseInt(minPrice), $lte: parseInt(maxPrice) };
            }

            try {
                const meals = await mealsCollections.find(filter).toArray();
                res.send(meals);
            } catch (error) {
                console.error('Error filtering meals:', error);
                res.status(500).send({ message: 'Internal server error' });
            }
        });
        app.get('/all_meals/search/:title', async (req, res) => {
            const searchTitle = req.params.title;
            try {
                const meals = await mealsCollections.find({ mealType: { $regex: searchTitle, $options: 'i' } }).toArray();
                res.send(meals);
            } catch (error) {
                console.error('Error searching meals:', error);
                res.status(500).send({ message: 'Internal server error' });
            }
        });

        app.get('/all_meals/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await mealsCollections.findOne(query);
            res.send(result);
        });
        app.get('/all_meals_count', async (req, res) => {
            const count = await mealsCollections.estimatedDocumentCount();
            res.send({ count });
        });

        app.post('/all_meals_review/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const reviewData = req.body;
            const result = await mealsCollections.updateOne(query, {
                $push: { reviews: reviewData },
            });
            res.send(result);
        });
        app.post('/add_meal', verifyToken, async (req, res) => {
            const mealData = req.body;
            const result = await mealsCollections.insertOne(mealData);
            res.send(result);
        });
        app.get('/all_meals/:id/reviews', verifyToken, async (req, res) => {
            const mealId = req.params.id;
            const meal = await mealsCollections.findOne({ _id: new ObjectId(mealId) });
            if (!meal) {
                return res.status(404).send({ message: 'Meal not found' });
            }
            const reviews = meal.reviews || [];
            res.send(reviews);
        });
        app.get('/all_meals/:id/reviewConfirm/:email', verifyToken, async (req, res) => {
            const mealId = req.params.id;
            const email = req.params.email;
            const meal = await mealsCollections.findOne({ _id: new ObjectId(mealId) });
            if (!meal) {
                return res.status(404).send({ message: 'Meal not found' });
            }
            const reviews = meal.reviews || [];
            const reviewExists = reviews.some((review) => review.email === email);
            res.send({ reviewExists });
        });
        app.post('/all_meals/:id/like', verifyToken, async (req, res) => {
            const mealId = req.params.id;

            try {
                const updatedMeal = await mealsCollections.findOneAndUpdate(
                    { _id: new ObjectId(mealId) },
                    { $inc: { likes: 1 } },
                    { returnDocument: 'after' }
                );

                if (!updatedMeal.value) {
                    return res.status(404).send({ message: 'Meal not found' });
                }

                res.send({ success: true });
            } catch (error) {
                console.error('Error updating like count in the database:', error);
                res.status(500).send({ message: 'Internal server error' });
            }
        });

        // upcomingMeals related api 
        app.get('/upcoming', async (req, res) => {
            const cursor = upcomingMealsCollections.find();
            const result = await cursor.toArray();
            res.send(result);
        });

        app.post('/upcoming', async (req, res) => {
            const cursor = upcomingMealsCollections.find();
            const result = await cursor.toArray();
            res.send(result);
        });
        app.get('/upcoming_meals', async (req, res) => {
            try {
                const { username, email } = req.query;
                const query = {};

                if (username) {
                    query.mealType = { $regex: new RegExp(username, 'i') };
                }

                if (email) {
                    query.gmail = { $regex: new RegExp(email, 'i') };
                }

                const requestedMeals = await upcomingMealsCollections.find(query).toArray();
                res.json(requestedMeals);
            } catch (error) {
                console.error('Error fetching requested meals:', error);
                res.status(500).json({ message: 'Internal server error' });
            }
        });
        app.post('/add_meal_upcoming', verifyToken, async (req, res) => {
            const mealData = req.body;
            const result = await upcomingMealsCollections.insertOne(mealData);
            res.send(result);
        });
        // user data post api 
        app.post('/users', async (req, res) => {
            const newUser = req.body;
            const result = await userCollections.insertOne(newUser)
            res.send(result);
        });
        app.get('/user/admin', async (req, res) => {
            try {
                const { username, email } = req.query;
                const query = {};

                if (username) {
                    query.name = { $regex: new RegExp(username, 'i') };
                }

                if (email) {
                    query.email = { $regex: new RegExp(email, 'i') };
                }

                const requestedMeals = await userCollections.find(query).toArray();
                res.json(requestedMeals);
            } catch (error) {
                console.error('Error fetching requested meals:', error);
                res.status(500).json({ message: 'Internal server error' });
            }
        });
        app.patch('/users', async (req, res) => {
            const newUser = req.body;
            const result = await userCollections.insertOne(newUser)
            res.send(result);
        });
        app.patch('/user/admin/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const info = req.body;
            console.log(info.status);
            const updateDoc = {
                $set: {
                    role: info?.role
                }
            }
            const result = await userCollections.updateOne(query, updateDoc);
            res.send(result);
        });
        app.patch('/user_package/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const info = req.body;
            console.log(info.package);
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    package: info?.package
                }
            }
            const result = await userCollections.updateOne(query, updateDoc, options);
            res.send(result);
        });
        // plans related api
        app.get('/plans', async (req, res) => {
            const cursor = paymentType.find();
            const result = await cursor.toArray();
            res.send(result);
        });

        app.get('/plans/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await paymentType.findOne(query);
            res.send(result);
        });
        //  perches plans user apis 
        app.get('/parchesPlan', async (req, res) => {
            const cursor = perchesPlanUsers.find();
            const result = await cursor.toArray();
            res.send(result);
        });
        app.post('/confirmPlans', async (req, res) => {
            const newUser = req.body;
            const result = await perchesPlanUsers.insertOne(newUser)
            res.send(result);
        });
        app.get('/plansConfirm/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await perchesPlanUsers.findOne(query);
            res.send(result);
        });
        //   payment related apis 
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        });
        // --------------------------------------------------------------------------
        // --------------------------------SSl Payment Gateway--------------------------------
        // --------------------------------------------------------------------------

        const tranId = new ObjectId().toString();
        app.post('/payment/ssl', async (req, res) => {
            const { info } = req?.body;
            const product = await paymentType.findOne({ _id: new ObjectId(info?.id) })
            const data = {
                total_amount: product?.price,
                currency: 'BDT',
                tran_id: tranId, // use unique tran_id for each api call
                success_url: `http://localhost:5000/payment/success/${tranId}`,
                fail_url: `http://localhost:5000/payment/fail/${tranId}`,
                cancel_url: 'http://localhost:5000/payment/cancel',
                ipn_url: 'http://localhost:3030/ipn',
                shipping_method: 'Courier',
                product_name: product?.name,
                product_category: 'web',
                product_profile: 'general',
                cus_name: info?.userName,
                cus_email: info?.userEmail,
                cus_add1: 'Dhaka',
                cus_add2: 'Dhaka',
                cus_city: 'Dhaka',
                cus_state: 'Dhaka',
                cus_postcode: '1000',
                cus_country: 'Bangladesh',
                cus_phone: '01711111111',
                cus_fax: '01711111111',
                ship_name: 'Customer Name',
                ship_add1: 'Dhaka',
                ship_add2: 'Dhaka',
                ship_city: 'Dhaka',
                ship_state: 'Dhaka',
                ship_postcode: 1000,
                ship_country: 'Bangladesh',
            };

            const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
            sslcz.init(data).then(apiResponse => {
                // Redirect the user to payment gateway
                let GatewayPageURL = apiResponse.GatewayPageURL
                res.send({ url: GatewayPageURL })

            });

            const finalOrder = {
                name: info?.userName,
                email: info?.userEmail,
                package: product?.name,
                paymentType: 'sslcommerz',
                Price: product?.price,
                paidStatus: false,
                transactionID: tranId
            }
            const result = await perchesPlanUsers.insertOne(finalOrder);


            app.post('/payment/success/:tranId', async (req, res) => {
                const id = req?.params?.tranId;
                const result = await perchesPlanUsers.updateOne({ transactionID: id }, {
                    $set: {
                        paidStatus: true,
                    }
                });

                if (result?.modifiedCount > 0) {
                    res.redirect(`http://localhost:5173/payment/success/${id}`)
                }
            });
            app.post('/payment/fail/:tranId', async (req, res) => {
                const id = req?.params?.tranId;
                const result = await perchesPlanUsers.deleteOne({ transactionID: id })
                if (result?.deletedCount > 0) {
                    res.redirect(`http://localhost:5173/payment/fail/${id}`)
                }
            });
        })
        // --------------------------------------------------------------------------
        // --------------------------------SSL Payment Gateway--------------------------------
        // --------------------------------------------------------------------------

        // --------------------------------------------------------------------------
        // --------------------------------Bkash Payment Gateway--------------------------------
        // --------------------------------------------------------------------------

        const bkash_headers = async () => {
            return {
                "Content-Type": "application/json",
                Accept: "application/json",
                authorization: globals.get('id_token'),
                'x-app-key': process.env.bkash_api_key,
            }
        }
        app.post("/bkash-checkout", bkashAuth, async (req, res) => {
            const { details } = req?.body;
            globals.set('productId', details?.id)
            globals.set('userName', details?.userName)
            globals.set('userEmail', details?.userEmail)
            const product = await paymentType.findOne({ _id: new ObjectId(details?.id) })
            try {
                const { data } = await axios.post(process.env.bkash_create_payment_url, {
                    mode: '0011',
                    payerReference: " ",
                    callbackURL: `${process.env.callbackURL}/bkash/payment/callback`,
                    amount: product?.price,
                    currency: "BDT",
                    intent: 'sale',
                    merchantInvoiceNumber: 'Inv' + uuidv4().substring(0, 9)
                }, {
                    headers: await bkash_headers()
                })
                return res.status(200).send({ bkashURL: data?.bkashURL })
            } catch (error) {
                return res.status(401).send({ error: error?.message })
            }


        })

        app.get("/bkash/payment/callback", bkashAuth, async (req, res) => {
            const { paymentID, status } = req.query

            if (status === 'cancel' || status === 'failure') {
                return res.redirect(`http://localhost:5173/error?message=${status}`)
            }
            if (status === 'success') {
                try {
                    const { data } = await axios.post(process?.env?.bkash_execute_payment_url, { paymentID }, {
                        headers: await bkash_headers()
                    })
                    const product = await paymentType.findOne({ _id: new ObjectId(globals.get('productId')) })

                    if (data && data?.statusCode === '0000') {
                        const finalOrder = {
                            name: globals.get('userName'),
                            email: globals.get('userEmail'),
                            paymentType: 'Bkash',
                            package: product?.name,
                            Price: parseInt(data?.amount) || product?.price,
                            customerMsisdn: data?.customerMsisdn,
                            transactionStatus: data?.transactionStatus,
                            paidStatus: true,
                            trxID: data?.trxID,
                            paymentID: data?.paymentID,
                            merchantInvoiceNumber: data?.merchantInvoiceNumber,
                            date: data?.paymentExecuteTime,
                        }
                        await perchesPlanUsers.insertOne(finalOrder);

                        return res.redirect(`http://localhost:5173/payment/success/${"hi"}`)
                    } else {
                        return res.redirect(`http://localhost:5173/error?message=${data?.statusMessage}`)
                    }
                } catch (error) {
                    console.log(error)
                    return res.redirect(`http://localhost:5173/error?message=${error?.message}`)
                }
            }
        })

        // Add this route under admin middleware
        app.post("/bkash-refund", bkashAuth, async (req, res) => {
            const { trxID } = req.params;
            try {
                const payment = await perchesPlanUsers.findOne({ trxID })

                const { data } = await axios.post(process.env.bkash_refund_transaction_url, {
                    paymentID: payment?.paymentID,
                    amount: payment?.amount,
                    trxID,
                    sku: 'payment',
                    reason: 'cashback'
                }, {
                    headers: await bkash_headers()
                })
                if (data && data.statusCode === '0000') {
                    return res.status(200).json({ message: 'refund success' })
                } else {
                    return res.status(404).json({ error: 'refund failed' })
                }
            } catch (error) {
                return res.status(404).json({ error: 'refund failed' })
            }
        })

        app.get("/bkash-search", async (req, res) => {
            try {
                const { trxID } = req.query
                const result = await searchTransaction(bkashConfig, trxID)
                res.send(result)
            } catch (e) {
                console.log(e)
            }
        })

        app.get("/bkash-query", async (req, res) => {
            try {
                const { paymentID } = req.query
                const result = await queryPayment(bkashConfig, paymentID)
                res.send(result)
            } catch (e) {
                console.log(e)
            }
        })

        // --------------------------------------------------------------------------
        // --------------------------------Bkash Payment Gateway End Here--------------------------------
        // --------------------------------------------------------------------------
        // --------------------------------------------------------------------------
        // --------------------------------Nagad Payment Gateway Start Here--------------------------------
        // --------------------------------------------------------------------------
      // Route to create a payment
app.post('/nagad-checkout', async (req, res) => {
    try {
        // const nagadURL = await nagad.createPayment({
        //     amount: '100',
        //     ip: '10.10.0.10',
        //     orderId: `${Date.now()}`,
        //     productDetails: { a: '1', b: '2' },
        //     clientType: 'PC_WEB',
        // });
        // Redirect user to the Nagad URL
        res.send({ url: nagadURL }); 
    } catch (err) {
        console.log(err);
        res.status(500).send('Internal Server Error');
    }
});

// Route to verify a payment
app.post('/verify-payment/:paymentRefID', async (req, res) => {
    const paymentRefID = req?.params?.paymentRefID;
    try {
        const nagadURL = await nagad.verifyPayment(paymentRefID);
        // Redirect user to the Nagad URL
        res.redirect(nagadURL);
    } catch (err) {
        console.log(err);
        res.status(500).send('Internal Server Error');
    }
});
        // --------------------------------------------------------------------------
        // --------------------------------Nagad Payment Gateway End Here--------------------------------
        // --------------------------------------------------------------------------

        // request for the meals api 
        app.post('/req_meal', async (req, res) => {
            const newRequest = req.body;
            const result = await requestMealsCollections.insertOne(newRequest)
            res.send(result);
        });
        app.delete('/req_meal/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await requestMealsCollections.deleteOne(query)
            res.send(result);
        });
        app.get('/requested_meals', verifyToken, async (req, res) => {
            try {
                const { username, email } = req.query;
                const query = {};

                if (username) {
                    query.customerName = { $regex: new RegExp(username, 'i') };
                }

                if (email) {
                    query.customerEmail = { $regex: new RegExp(email, 'i') };
                }

                const requestedMeals = await requestMealsCollections.find(query).toArray();
                res.json(requestedMeals);
            } catch (error) {
                console.error('Error fetching requested meals:', error);
                res.status(500).json({ message: 'Internal server error' });
            }
        });
        app.patch('/req_meal_status/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const info = req.body;
            const updateDoc = {
                $set: {
                    status: info?.status
                }
            }
            const result = await requestMealsCollections.updateOne(query, updateDoc);
            res.send(result);
        });

        app.get('/req_meal/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { customerEmail: email }
            const result = await requestMealsCollections.find(query).toArray();
            res.send(result);
        });
        app.get('/req_meal', verifyToken, async (req, res) => {
            try {
                const result = await requestMealsCollections.find().toArray();
                res.json(result);
            } catch (error) {
                console.error('Error fetching requested meals:', error);
                res.status(500).json({ message: 'Internal server error' });
            }
        });

        // review collection related api 
        app.post('/reviewsCollections', verifyToken, async (req, res) => {
            const newReview = req.body;
            const result = await reviewCollections.insertOne(newReview)
            res.send(result);
        });
        app.get('/reviews/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { customerEmail: email };
            const result = await reviewCollections.find(query).toArray();
            res.send(result);
        });
        app.delete('/reviews/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { customerEmail: email }
            const result = await reviewCollections.deleteOne(query);
            res.send(result);
        });

        app.patch('/reviews/:id', verifyToken, async (req, res) => {
            try {
                const id = req.params.id;
                const { updatedText } = req.body;

                const query = { _id: new ObjectId(id) };
                const update = { $set: { text: updatedText } };

                const result = await reviewCollections.updateOne(query, update);

                if (result.modifiedCount === 0) {
                    return res.status(404).json({ success: false, message: 'Review not found' });
                }

                res.json({ success: true, updatedCount: result.modifiedCount });
            } catch (error) {
                console.error('Error updating review field:', error);
                res.status(500).send({ success: false, message: 'Internal server error' });
            }
        });

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send("Server Is Running Hot!")

});
app.listen(port, () => {
    console.log(`Server is running port: ${port}`)
});

