const path = require("path");
const express = require("express");
const dotenv = require("dotenv");
const morgan = require("morgan");
require("colors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const cors = require("cors");
const errorHandler = require("./middleware/error");
const connectDB = require("./config/db");
const {initializeSocket} = require("./listeners/socketManager");
const http = require("http");
const {Server} = require("socket.io");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const compression = require("compression");
const {
    socketMiddleware,
} = require("./middleware/auth");
const bodyParser = require("body-parser");
const dailyCleanup = require("./utils/dailyCleanup");
const declineCall = require("./utils/declineCall");

// Other application setup code...

dotenv.config({
    path:
        process.env.NODE_ENV !== "production"
            ? "./config/.env.development"
            : "./config/.env.production",
});

// Route files
const auth = require("./routes/auth");
const authAdmin = require("./routes/authAdmin");
const category = require("./routes/category");
const product = require("./routes/product");
const order = require("./routes/order");
const restaurant = require("./routes/restaurant");
const table = require("./routes/table");
const typeOfTable = require("./routes/typeOfTable");
const upload = require("./routes/upload");
const waiter = require("./routes/waiter");
const client = require("./routes/client");
const approvedOrder = require("./routes/approvedOrder");

const app = express();
const server = http.createServer(app);

// Enable CORS
const whiteList = process.env.WHITE_LIST
    ? process.env.WHITE_LIST.split(",")
    : [];
const corsOptions = () => process.env.NODE_ENV === "production" ? {
    origin: function (origin, callback) {
        // Allow no origin (for Postman, etc.)
        if (!origin) return callback(null, true);

        // Check if the origin is in the whitelist
        if (whiteList.indexOf(origin) !== -1) {
            return callback(null, true);
        } else {
            return callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
} : {}

app.use(cors(corsOptions()));

// Body parser
app.use(
    bodyParser.json({
        limit: "2000mb",
    }),
);

app.use(
    bodyParser.urlencoded({
        extended: true,
        limit: "2000mb",
    }),
);

// Cookie parser
app.use(cookieParser());

// Compress all responses
app.use(compression());

// Dev logging middleware
if (process.env.NODE_ENV === "development") {
    app.use(morgan("dev"));
} else {
    app.use(morgan("combined"));
}
// Sanitize data
app.use(mongoSanitize());

// Set security headers
app.use(helmet());

// Prevent http param pollution
app.use(hpp({}));

// Mount routers
app.use("/api/v1/auth", auth);
app.use("/api/v1/auth/admin", authAdmin);
app.use("/api/v1/categories", category);
app.use("/api/v1/products", product);
app.use("/api/v1/orders", order);
app.use("/api/v1/restaurants", restaurant);
app.use("/api/v1/tables/type", typeOfTable);
app.use("/api/v1/tables", table);
app.use("/api/v1/upload", upload);
app.use("/api/v1/waiters", waiter);
app.use("/api/v1/clients", client);
app.use("/api/v1/approved/orders", approvedOrder);

// Set static folder
app.use("/uploads", [
    cors(corsOptions()),
    express.static(path.join(__dirname, "uploads")),
]);

if (process.env.NODE_ENV === "production") {
    app.get("*", (req, res) => {
        res.sendFile(path.join(__dirname, "/../client/dist", "index.html"));
    });
} else {
    app.get("/", (req, res) => {
        res.send("API is running...");
    });
}

// error handler
app.use(errorHandler);

// unhandled promise rejection
process.on("unhandledRejection", (err) => {
    console.log(`Error: ${err.message}`.red);
    server.close(() => process.exit(1));
});

// socket initialization
const io = new Server(server, {
    cookie: true,
    cors: {
        origin: process.env.development ? '*' : process.env.WHITE_LIST.split(","),
        credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 5000,
});

io.use(socketMiddleware);
io.engine.use(helmet());
initializeSocket(io);

// start server
(async () => {
    try {
        const connection = await connectDB();
        console.log(
            `MongoDB Connected: ${connection.connection.host}`.cyan.underline.bold,
        );

        const PORT = process.env.PORT || 5000;

        server.listen(PORT, () =>
            console.log(
                `Server running in ${process.env.NODE_ENV} mode on port ${PORT}`.yellow
                    .bold,
            ),
        );
    } catch (error) {
        console.error(`Error: ${error.message}`.red);
        process.exit(1);
    }
})();
