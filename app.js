const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
const bcrypt = require("bcrypt");
const jsonwebtoken = require("jsonwebtoken");

const dbPath = path.join(__dirname, "twitterClone.db");
app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

//API-1 Register

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  try {
    let isUserExist = `SELECT username from user WHERE username= '${username}'`;
    isUserExist = await db.get(isUserExist);
    // console.log(isUserExist);
    if (isUserExist === undefined) {
      if (password.length >= 6) {
        const hashedPassword = await bcrypt.hash(password, 10);
        // console.log(hashedPassword);
        const updateUser = `INSERT INTO user ( username, password, name,gender) 
                             VALUES ('${username}', '${hashedPassword}','${name}','${gender}');`;
        try {
          const dbUpdate = await db.run(updateUser);
          response.status(200);
          response.send("User created successfully");
        } catch (error) {
          console.log(error);
        }
      } else {
        response.status(400);
        response.send("Password is too short");
      }
    } else {
      response.status(400);
      response.send("User already exists");
    }
  } catch (e) {
    console.log(e);
  }
});

//API-2 Login
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  let isUserExist = `SELECT * from user WHERE username= '${username}'`;
  isUserExist = await db.get(isUserExist);
  if (isUserExist != undefined) {
    if (password.length >= 6) {
      const isPasswardValid = await bcrypt.compare(
        password,
        isUserExist.password
      );
      if (isPasswardValid) {
        const payload = {
          username: username,
        };
        const jwtToken = jsonwebtoken.sign(payload, "MY_SECRET_TOKEN");
        response.send({ jwtToken });
        response.status(200);
        console.log(jwtToken);
      } else {
        response.status(400);
        response.send("Invalid password");
      }
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jsonwebtoken.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { username } = request;
  const selectUserQuery = `SELECT user_id FROM user WHERE username = '${username}';`;
  const user = await db.get(selectUserQuery);
  try {
    const tweetQuery = `SELECT user.name as username,tweet.tweet,tweet.date_time as dateTime FROM user join tweet on user.user_id= tweet.user_id WHERE user.user_id IN (SELECT following_user_id FROM follower WHERE follower.follower_user_id = ${user.user_id}) order by tweet.date_time limit 4 offset 0`;
    const tweetQueryList = await db.all(tweetQuery);
    console.log(tweetQueryList);
    response.send(tweetQueryList);
  } catch (e) {
    console.log(e);
  }
});

module.exports = app;
