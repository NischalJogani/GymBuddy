/**
 * @jest-environment jsdom
 */

// All Node Modules Used are Required first over here.
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const ejs = require("ejs");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-find-or-create");
const cookieParser = require("cookie-parser");
const _ = require("lodash");
const { MongoClient } = require("mongodb");
const { json } = require("body-parser");
const { get } = require("lodash");
const { Redirect } = require("request/lib/redirect");
const { use } = require("passport");
const mongooseTypeUrl = require("mongoose-type-url");
const mongooseTypeEmail = require("mongoose-type-email");
const Email = require("mongoose-type-email");

// Created the server
const app = express();
const foodList = [
    "Rice",
    "Roti",
    "Oats",
    "Milk",
    "Yogurt",
    "Butter",
    "Ghee",
    "Peanut butter",
    "Potato Curry",
    "Fafda",
    "Jalebi",
    "Buttermilk",
    "Curd",
    "Bhakri",
    "Tomato",
    "Avocado",
    "Banana",
    "Apple",
    "Watermelon",
    "Eggplant",
    "Orange",
    "Strawberry",
    "Blueberry",
    "Raspberry",
    "Pear",
    "Tangerine",
    "Kiwi",
    "Peach",
    "Mango",
    "Carrot",
    "Broccoli",
    "Mushroom",
    "Corn",
];


// App Configuration
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
// app.use(cookieParser());

// App Session
app.use(
    session({
        secret: process.env.SESSIONSECRET,
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 21 * 24 * 60 * 60 * 1000 },
    })
);

// Session Created and initialized
app.use(passport.session());
app.use(passport.initialize());

// MongoDB Connection
mongoose.connect(
    "mongodb+srv://admin-mann:" +
    process.env.MONGODBPASSWORD +
    "@gymbuddy.hdshaf4.mongodb.net/GymBuddy?retryWrites=true&w=majority",
    { useNewUrlParser: true },
    function (err) {
        if (err) {
            console.log(err);
        } else {
            console.log("Database Connected");
        }
    }
);

// Creating User, Food, Exercise Schemas
const foodSchema = new mongoose.Schema({
    name: { type: String, required: true },
    calorie: { type: String, required: true },
    fat: { type: String, required: true },
    carbs: { type: String, required: true },
    protein: { type: String, required: true },
    Fiber: { type: String, required: true },
});

const exerciseSchema = new mongoose.Schema({
    name: { type: String, required: true },
    caloriePerMin: { type: String, required: true },
    caloriePer30min: { type: String, required: true },
    imgPath: { type: mongoose.SchemaTypes.Url, required: true },
});

const userSchema = new mongoose.Schema({
    username: { type: String, maxLength: 30 },
    nutritions: Array,
    password: { type: String },
    googleId: String,
    email: String,
    bmi: { type: mongoose.Types.Decimal128 },
    height: Number,
    weight: Number,
    weightLog: Array,
});

// Schema Plugins
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

foodSchema.plugin(passportLocalMongoose);
foodSchema.plugin(findOrCreate);

exerciseSchema.plugin(passportLocalMongoose);
exerciseSchema.plugin(findOrCreate);

// Creating the collections
const User = new mongoose.model("User", userSchema);
const Food = new mongoose.model("Food", foodSchema);
const Exercise = new mongoose.model("Exercise", exerciseSchema);

// Logging in, Session Serialising and deserialising
passport.serializeUser(function (user, done) {
    done(null, {
        id: user.id,
        username: user.username,
    });
});

passport.deserializeUser(function (user, done) {
    done(null, user);
});

// Local Authentication
passport.use(User.createStrategy());

// Google Authentication
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLECLIENTID,
            clientSecret: process.env.GOOGLECLIENTSECRET,
            callbackURL: "http://localhost:3000/auth/google/success",
            userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
        },
        function (accessToken, refreshToken, profile, cb) {
            User.findOrCreate(
                {
                    googleId: profile.id,
                    username: profile.displayName,
                    nutritions: [],
                    weight: 0,
                    height: 0,
                    bmi: 0,
                    weightLog: [],
                },
                function (err, user) {
                    return cb(err, user);
                }
            );
        }
    )
);

// Signup Route
app.get("/signup", function (req, res) {
    res.render("signup");
});

// Signup submit route
app.post("/signup", function (req, res) {
    var newUser = new User({
        username: req.body.username,
        nutritions: [],
        email: req.body.email || "",
        bmi: 0,
        weightLog: [],
    });

    // Register the new user
    User.register(newUser, req.body.password, (err, user) => {
        if (err) {
            console.log(err);
            res.redirect("/signup");
        } else {
            passport.authenticate("local")(req, res, () => {
                res.cookie("username", req.user.username);
                console.log("Authenticated");
                res.redirect("/bmi");
            });
        }
    });
});

// Google Auth Route
app.get(
    "/auth/google",
    passport.authenticate("google", { scope: ["profile"] })
);

app.get(
    "/auth/google/success",
    passport.authenticate("google", { failureRedirect: "/signup" }),
    function (req, res) {
        req.session.save();
        res.cookie("username", req.user.username);
        res.redirect("/calculate");
    }
);

// Login page route
app.get("/login", function (req, res) {
    res.render("login");
});

// login submit route
app.post("/login", function (req, res, next) {
    const user = new User({
        username: req.body.username,
        password: req.body.password,
    });
    req.logIn(user, function (err) {
        if (err) {
            return next(err);
        }
        passport.authenticate("local", function (err, user, info) {
            if (err) {
                return next(err);
            }
            if (!user) {
                return res.redirect("/login");
            }
            req.logIn(user, function (err) {
                if (err) {
                    return next(err);
                } else {
                    res.cookie("username", req.body.username);
                    console.log("Authenticated");
                    res.redirect("/bmi");
                }
            });
        })(req, res, next);
    });
});

// Calculator Route
app.get("/nutrition-calc", function (req, res) {
    if (req.isAuthenticated()) {
        res.render("calculate", { foodItems: foodList });
    } else {
        res.redirect("/signup");
    }
});

// Calorie Calculation Route
//         .then((savedUser) => {
//             // Return caloriePerG and savedUser to the client
//             if (calorieIntake >= 2000) {
//                 Exercise.find({}, { name: 1, caloriePerMin: 1 }).then(
//                     (foundExercise) => {
//                         excersies = _.sampleSize(foundExercise, 3);
//                         excersies.forEach(function (exercise) {
//                             exerciseName = exercise.name;
//                             exerciseTime = (calorieIntake - 2000) / exercise.caloriePerMin;
//                             console.log("....");
//                             console.log(exerciseName);
//                             console.log(exerciseTime);
//                         });
//                     }
//                 );
//             }
//             res.render("added", {
//                 calorieCalc: calorie,
//                 calorieCount: totalCalorie,
//                 foodName: foodName,
//                 foodQuantity: quantity,
//             });
//         })
//         .catch((error) => {
//             // Handle errors
//             console.error(error);
//             res.status(500).json({ error: "An error occurred." });
//         });
// });


// Meal Analysis Route
app.post("/nutrition-calc", function (req, res) {
    // All data from the form
    const foodName = req.body.foodName;
    const approxWeight = req.body.foodWeight;
    const quantity = req.body.foodQuantity;
    const volume = req.body.foodVolume;
    const username = req.cookies.username;

    let calorie, protein, carbs, fat, fiber;

    // Use Promise.all to wait for both queries to complete before returning the results
    Promise.all([
        Food.find({ name: foodName }),
    ])
        .then((results) => {
            const foundFood = results[0][0];

            const caloriePerG = foundFood.calorie;
            const proteinPerG = foundFood.protein;
            const fatPerG = foundFood.fat;
            const carbsPerG = foundFood.carbs;
            const fiberPerG = foundFood.Fiber;

            if (!quantity == "") {
                calorie = Math.round(caloriePerG * approxWeight * quantity, 2);
                protein = Math.round(proteinPerG * approxWeight * quantity, 2);
                carbs = Math.round(carbsPerG * approxWeight * quantity, 2);
                fat = Math.round(fatPerG * approxWeight * quantity, 2);
                fiber = Math.round(fiberPerG * approxWeight * quantity, 2);
            } else if (!volume == "") {
                calorie = Math.round(caloriePerG * approxWeight * volume, 2);
                protein = Math.round(proteinPerG * approxWeight * volume, 2);
                carbs = Math.round(carbsPerG * approxWeight * volume, 2);
                fat = Math.round(fatPerG * approxWeight * volume, 2);
                fiber = Math.round(fiberPerG * approxWeight * volume, 2);
            } else {
                calorie = Math.round(caloriePerG * approxWeight, 2);
                protein = Math.round(proteinPerG * approxWeight, 2);
                carbs = Math.round(carbsPerG * approxWeight, 2);
                fat = Math.round(fatPerG * approxWeight, 2);
                fiber = Math.round(fiberPerG * approxWeight, 2);
            }
            nutrition_data = [
                { calorie: calorie },
                { protein: protein },
                { carbs: carbs },
                { fat: fat },
                { fiber: fiber },
            ]

            User.findOneAndUpdate({ username: username }, { nutritions: nutrition_data }, { new: true })
                .then(updatedUser => {
                    res.cookie("action", "Nutritions", { maxAge: 900000, httpOnly: true });
                    res.redirect("/added")
                })
                .catch(err => {
                    console.log(err)
                    // handle error
                });
        })
});


// Weight log Route
app.get("/weight-log", function (req, res) {
    res.render("weight-log")
});

// weight calc ruote
app.post("/weight-log", function (req, res) {
    const date = req.body.logDate;
    const weight = req.body.logWeight;
    const username = req.cookies.username;

    User.findOneAndUpdate({ username: username }, { $push: { weightLog: { date: date, weight: weight } } })
        .then(function (updatedUser) {
            res.cookie("action", "Weight Log", { maxAge: 900000, httpOnly: true });
            res.redirect("/added")
        })
        .catch(function (err) {
            console.log(err);
            res.status(500).send("Error updating user");
        });
})


// BMI Route
app.get("/bmi", function (req, res) {
    if (req.isAuthenticated()) {
        res.render("bmi", { foodItems: foodList });
    } else {
        res.render("signup");
    }
});

// BMI Submit Route
app.post("/bmi", function (req, res) {
    const weight = req.body.userWeight;
    const height = req.body.userHeight;
    const username = req.cookies.username;

    var bmi = (weight / (height ** 2)).toFixed(2);

    User.findOneAndUpdate({ username: username }, { bmi: bmi }, { new: true })
        .then(updatedUser => {
            res.cookie("action", "BMI", { maxAge: 900000, httpOnly: true });
            res.redirect("/added")
        })
        .catch(err => {
            console.log(err)
            // handle error
        });
});


// When something is updated/added in db
app.get("/added", function (req, res) {
    const lastAction = req.cookies.action
    const username = req.cookies.username

    var actionData;
    User.find({ username: username })
        .then(foundUser => {
            if (lastAction == null) {
                res.send("Wrong Access")
            } else if (lastAction == "Nutritions") {
                actionData = foundUser[0].nutritions
            } else if (lastAction == "BMI") {
                actionData = foundUser[0].bmi
            } else if (lastAction == "Weight Log") {
                actionData = foundUser[0].weightLog
            } else {
                actionData = "Nothing Caught"
            }

            if (actionData && actionData.length > 0) {
                res.render("added", { action: lastAction, data: actionData })
            } else {
                res.render("added", { action: lastAction, message: "No data available" })
            }
        })
        .catch(err => {
            console.log(err);
            res.send("Error in fetching data");
        });
});


app.get("/profile", function (req, res) {
    if (req.isAuthenticated()) {
        const username = req.cookies.username;

        let nutrition_data, weightLog;
        User.find({ username: username })
            .then(foundUser => {
                nutrition_data = foundUser[0].nutritions
                weightLog = foundUser[0].weightLog
                res.render("profile", { user: foundUser[0], nutrition: nutrition_data, weightLog: weightLog })
            })
    } else {
        res.redirect("/signup")
    }
})


app.get("faq", function (req, res) {
    res.render("faq")
})


app.get("/", function (req, res) {
    res.render("home");
});

// App running and workign on the specified port
app.listen(process.env.PORT || 3000, function () {
    console.log("Server Started...");
});
