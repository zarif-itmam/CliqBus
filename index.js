const express = require("express");
const cors = require("cors");
const oracledb = require("oracledb");
oracledb.outFormat = oracledb.OBJECT;
var path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const { stat } = require("fs");
const { start } = require("repl");

let loggedIn = false;
let user = undefined;
let userName = undefined;
//! errorcode 0 => no error
//! errorcode 1 => no such user
//! errorcode 2 => incorrect credentials
//! errorcode 3 => duplicate email or phone number
let errorCode = 0;

const app = express();
app.use(cors());
app.options("*", cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(session({
  secret: 'secret',
  resave: false,
  saveUninitialized: true,
}));

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.listen(5000, () => {
  console.log("Server running on port 5000");
});

const dbConfig = {
  user: "TEST",
  password: "12345",
  connectionString: "localhost/orclpdb",
};

let connection = undefined;

async function db_query(query, params) {
  if (connection === undefined) {
    connection = await oracledb.getConnection(dbConfig);
  }

  try {
    let result = await connection.execute(query, params);
    return result.rows;
  } catch (err) {
    console.log(err);
  }
}

app.get("/admin/home", async (req, res) => {
  res.render("admin-home");
});

app.get("/admin/ticket", async (req, res) => {
  const query = `SELECT * FROM TICKET ORDER BY TICKET_ID`;
  const params = [];
  const result = await db_query(query, params);
  res.render("admin-ticket-home", { result });
});

app.get("/admin/bus_company", async (req, res) => {
  const query = `SELECT * FROM BUS_COMPANY ORDER BY BUS_COMPANY_ID`;

  const params = [];

  const result = await db_query(query, params);

  res.render("admin-bus_company-home", { result });
});

app.get("/admin/bus", async (req, res) => {
  const query = `
    SELECT BC.BUS_COMPANY_NAME, B.BUS_TYPE, B.SEAT_COUNT, B.BUS_RATING
      FROM BUS B
      JOIN BUS_COMPANY BC 
      ON B.BUS_COMPANY_ID = BC.BUS_COMPANY_ID
      ORDER BY BUS_ID`;

  const params = [];

  const result = await db_query(query, params);

  res.render("admin-bus-home", { result });
});

app.get("/admin/route", async (req, res) => {
  try {
    const query=`SELECT 
      SS.STAND_NAME AS START_STAND,
      ES.STAND_NAME AS END_STAND,
      R.ROUTE_ID,
      GET_INTERMEDIATE_STANDS(R.ROUTE_ID) AS INTERMEDIATE_STANDS,
      GET_TOTAL_DISTANCE(R.ROUTE_ID) AS DISTANCE 
      FROM ROUTE R 
      JOIN STAND SS 
      ON R.START_STAND_ID=SS.STAND_ID 
      JOIN STAND ES 
      ON R.END_STAND_ID=ES.STAND_ID 
      JOIN DISTANCE D 
      ON R.START_STAND_ID=D.STARTING_STAND AND R.END_STAND_ID=D.ENDING_STAND`;

    // const query = `SELECT * FROM ROUTE ORDER BY ROUTE_ID`;
    const params = [];
    const result = await db_query(query, params);
    for(let i=0;i<result.length;i++){
      await connection.execute(
        `INSERT INTO LOG
        VALUES(SEQ_LOG.NEXTVAL,'GET_INTERMEDIATE_STANDS',SYSDATE,${result[i].ROUTE_ID})`,{}, { autoCommit: true }
      );
      await connection.execute(
        `INSERT INTO LOG
        VALUES(SEQ_LOG.NEXTVAL,'GET_TOTAL_DISTANCE',SYSDATE,${result[i].ROUTE_ID})`,{}, { autoCommit: true }
      );
    }
    console.log(result);
    res.render("admin-route-home", { result });
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/admin/route/insert", async (req, res) => {
  res.render("admin-route-insert");
});

app.post("/admin/route/insert", async (req, res) => {
  try {
    console.log(req.body);

    const startStandName = req.body.startStandName;
    const endStandName = req.body.endStandName;

    const intermediateStand = req.body.intermediateStand;
    console.log(intermediateStand);

    let standArray = [];
    standArray.push(startStandName);

    for(let i=0;i<intermediateStand.length;i++){
      if(intermediateStand[i]!=="")
        standArray.push(intermediateStand[i]);
    }
    standArray.push(endStandName);
    
    if(connection===undefined){
      connection = await oracledb.getConnection(dbConfig);
    }
    const routeId=await connection.execute(`SELECT SEQ_ROUTE.NEXTVAL FROM DUAL`,{});
    console.log(routeId);

    const query = `INSERT INTO ROUTE (ROUTE_ID, START_STAND_ID, END_STAND_ID) VALUES (${routeId.rows[0].NEXTVAL}, GET_STAND_ID(:startStandName), GET_STAND_ID(:endStandName))`;

    await connection.execute(`INSERT INTO LOG VALUES(SEQ_LOG.NEXTVAL,'GET_STAND_ID',SYSDATE, '${startStandName}')`, {}, { autoCommit: true });

    await connection.execute(`INSERT INTO LOG VALUES(SEQ_LOG.NEXTVAL,'GET_STAND_ID',SYSDATE,'${endStandName.replace('\'', '\'\'')}')`, {}, { autoCommit: true });

    const params = {
      startStandName: { val: startStandName },
      endStandName: { val: endStandName },
    };

    const options = {
      autoCommit: true,
    };

    await connection.execute(query, params, options);
    console.log(standArray);
    for (let i = 0; i < standArray.length; i++) {
      const standId=await connection.execute(`SELECT GET_STAND_ID('${standArray[i].replace('\'', '\'\'')}') FROM DUAL`,{});
      console.log(standId)
      const query2 = `INSERT INTO ROUTE_STAND (ROUTE_STAND_ID, ROUTE_ID, STAND_ID) VALUES (SEQ_ROUTE_STAND.NEXTVAL, ${routeId.rows[0].NEXTVAL}, GET_STAND_ID('${standArray[i].replace('\'', '\'\'')}'))`;
      await connection.execute(`INSERT INTO LOG VALUES(SEQ_LOG.NEXTVAL,'GET_STAND_ID',SYSDATE,'${standArray[i].replace('\'', '\'\'')}')`, {}, { autoCommit: true });

      const params2 = {
        // startStandName: { val: startStandName },
        // endStandName: { val: endStandName },
      };

      const options2 = {
        autoCommit: true,
      };

      if (connection === undefined) {
        connection = await oracledb.getConnection(dbConfig);
      }

      await connection.execute(query2, params2, options2);
    }

    res.redirect("/admin/route");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/admin/route/update", async (req, res) => {
  try {
    const query=`
      SELECT SS.STAND_NAME AS START_STAND,
        ES.STAND_NAME AS END_STAND,
        GET_INTERMEDIATE_STANDS(R.ROUTE_ID) AS INTERMEDIATE_STANDS,
        GET_TOTAL_DISTANCE(R.ROUTE_ID) AS DISTANCE,
        R.ROUTE_ID 
        FROM ROUTE R 
        JOIN STAND SS ON R.START_STAND_ID=SS.STAND_ID 
        JOIN STAND ES ON R.END_STAND_ID=ES.STAND_ID 
        JOIN DISTANCE D ON R.START_STAND_ID=D.STARTING_STAND AND R.END_STAND_ID=D.ENDING_STAND`;

    const params = [];
    const result = await db_query(query, params);
    console.log(result);
    for(let i=0;i<result.length;i++){
      await connection.execute(
        `INSERT INTO LOG
        VALUES(SEQ_LOG.NEXTVAL,'GET_INTERMEDIATE_STANDS',SYSDATE,${result[i].ROUTE_ID})`,{}, { autoCommit: true }
      );
      await connection.execute(
        `INSERT INTO LOG
        VALUES(SEQ_LOG.NEXTVAL,'GET_TOTAL_DISTANCE',SYSDATE,${result[i].ROUTE_ID})`,{}, { autoCommit: true }
      );
    }
    res.render("admin-route-update", { result });
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/admin/route/update", async (req, res) => {
  try {
    console.log(req.body);

    const routeId = req.body.routeId;
    console.log(routeId);
    const startStandName = req.body.startStandName;
    console.log(startStandName);
    const endStandName = req.body.endStandName;
    const routeIndex=req.body.routeIndex;
    const intermediateStandName='intermediateStand'+routeIndex;
    console.log(intermediateStandName)
    const intermediateStand = req.body[intermediateStandName];
    console.log(intermediateStand);

    let standArray = [];
    standArray.push(startStandName);
    console.log(startStandName);
    for (let i = 0; i < intermediateStand.length; i++) {
      if (intermediateStand[i] !== "")
        standArray.push(intermediateStand[i]);
    }
    standArray.push(endStandName);

    for (let i = 0; i < standArray.length; i++) {
      standArray[i] = standArray[i].trim();
    }
    console.log(standArray);
    
    if(connection===undefined){
      connection = await oracledb.getConnection(dbConfig);
    }

    console.log(startStandName);

    console.log(await connection.execute(`SELECT COUNT(*) AS CNT FROM ROUTE_STAND`),{});
    const deleteQuery = `DELETE FROM ROUTE_STAND WHERE ROUTE_ID = ${routeId}`;
    await connection.execute(deleteQuery, {}, { autoCommit: true });
    console.log(await connection.execute(`SELECT COUNT(*) AS CNT FROM ROUTE_STAND`),{});
    for(let i=0;i<standArray.length;i++){
      const insertQuery = `INSERT INTO ROUTE_STAND (ROUTE_STAND_ID, ROUTE_ID, STAND_ID) VALUES (SEQ_ROUTE_STAND.NEXTVAL, ${routeId}, GET_STAND_ID('${standArray[i].replace('\'', '\'\'')}'))`;
      await connection.execute(insertQuery, {}, { autoCommit: true });

      await connection.execute(`INSERT INTO LOG VALUES(SEQ_LOG.NEXTVAL,'GET_STAND_ID',SYSDATE,'${standArray[i].replace('\'', '\'\'')}')`, {}, { autoCommit: true });
    }

    res.redirect("/admin/route");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/admin/route/delete", async (req, res) => {
  try {
    
    const query=`
      SELECT SS.STAND_NAME AS START_STAND,
      ES.STAND_NAME AS END_STAND,
      GET_INTERMEDIATE_STANDS(R.ROUTE_ID) AS INTERMEDIATE_STANDS,
      GET_TOTAL_DISTANCE(R.ROUTE_ID) AS DISTANCE, 
      R.ROUTE_ID 
      FROM ROUTE R 
      JOIN STAND SS ON R.START_STAND_ID=SS.STAND_ID 
      JOIN STAND ES ON R.END_STAND_ID=ES.STAND_ID 
      JOIN DISTANCE D ON R.START_STAND_ID=D.STARTING_STAND AND R.END_STAND_ID=D.ENDING_STAND`;

    // const query = `SELECT * FROM ROUTE ORDER BY ROUTE_ID`;
    const params = [];
    const result = await db_query(query, params);
    console.log(result);
    res.render("admin-route-delete", { result });
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/admin/route/delete", async (req, res) => {
  try {
    console.log(req.body);

    const routeId = req.body.routeId;

    const query = `DELETE FROM ROUTE WHERE ROUTE_ID = :routeId`;

    const params = {
      routeId: { val: routeId },
    };

    const options = {
      autoCommit: true,
    };

    if (connection === undefined) {
      connection = await oracledb.getConnection(dbConfig);
    }

    await connection.execute(query, params, options);

    res.redirect("/admin/route/delete");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/admin/bus_company_stats", async (req, res) => {
  const busComapnyQuery = `SELECT BUS_COMPANY_NAME FROM BUS_COMPANY`;
  const busCompanyParams = {};
  const busCompanyResult = await db_query(busComapnyQuery, busCompanyParams);
  let result = [];
  if(connection===undefined){
    connection = await oracledb.getConnection(dbConfig);
  }
  for (let i = 0; i < busCompanyResult.length; i++) {
    const name = busCompanyResult[i].BUS_COMPANY_NAME;
    const result1=await connection.execute(
      `BEGIN
        GET_BUS_COMPANY_REVENUE(\'${name}\',:REVENUE);
        END;`,{
          REVENUE:{dir:oracledb.BIND_OUT,type:oracledb.NUMBER}
        }
    )
    console.log(result1);
    const result2=await connection.execute(
      `BEGIN 
        GET_BUS_COMPANY_TICKETS_SOLD(\'${name}\',:TICKETS_SOLD);
      END;`,{
        TICKETS_SOLD:{dir:oracledb.BIND_OUT,type:oracledb.NUMBER}
      }
    )
    console.log(result2);
    const result3=await connection.execute(
      `BEGIN 
        GET_BUS_COMPANY_RATING(\'${name}\',:RATING);
      END;`,{
        RATING:{dir:oracledb.BIND_OUT,type:oracledb.NUMBER}
      }
    )
    console.log(result3);
    result.push({
      BUS_COMPANY_NAME: name,
      REVENUE: result1.outBinds.REVENUE,
      TICKETS_SOLD: result2.outBinds.TICKETS_SOLD,
      RATING: result3.outBinds.RATING,
    });
  }
  console.log(result);
  // res.render("admin-stats-home", { result });
  res.render("admin-bus-company-stats", { result });
});

app.get("/admin/logs", async (req, res) => {
  const query = `SELECT * FROM LOG ORDER BY LOG_ID DESC`;
  const params = [];
  const result = await db_query(query, params);
  res.render("admin-logs-home", { result });
});

app.get("/admin/user/all", async (req, res) => {
  const query = `SELECT * FROM USER_ACCOUNT
                    ORDER BY USER_ID`;
  const params = [];

  const result = await db_query(query, params);

  res.render("admin-user-home", { result });
});

app.get("/admin/user/insert", async (req, res) => {
  res.render("admin-user-insert");
});

app.post("/admin/user/insert", async (req, res) => {
  try {
    console.log(req.body);

    const username = req.body.username;
    const phoneNo = req.body.phoneNo;
    const email = req.body.email;
    let password = req.body.password;

    const query1 = `SELECT ORA_HASH('${password}') AS PASSWORD FROM DUAL`;
    const params1 = {};
    const result1 = await db_query(query1, params1);

    password = result1[0].PASSWORD;

    const query = `
      INSERT INTO USER_ACCOUNT (USER_ID, NAME, PHONE_NO, EMAIL, PASSWORD) VALUES (SEQ_USER.NEXTVAL, :username, :phoneNo, :email, :password)`;

    const params = {
      username: { val: username },
      phoneNo: { val: phoneNo },
      email: { val: email },
      password: { val: password },
    };

    const options = {
      autoCommit: true,
    };

    await connection.execute(query, params, options);

    res.redirect("/admin/user/all");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/admin/user/update", async (req, res) => {
  res.render("admin-user-update");
});

app.post("/admin/user/update", async (req, res) => {
  try {
    console.log(req.body);

    const username = req.body.username;
    const phoneNo = req.body.phoneNo;
    const email = req.body.email;
    let password = req.body.password;

    const query1 = `SELECT ORA_HASH('${password}') AS PASSWORD FROM DUAL`;
    const params1 = {};
    const result1 = await db_query(query1, params1);

    password = result1[0].PASSWORD;

    const query = `
      UPDATE USER_ACCOUNT 
      SET NAME = :username,
         PHONE_NO = :phoneNo,
         EMAIL = :email,
         PASSWORD = :password 
      WHERE EMAIL = :email`;

    const params = {
      username: { val: username },
      phoneNo: { val: phoneNo },
      email: { val: email },
      password: { val: password },
    };

    const options = {
      autoCommit: true,
    };

    await connection.execute(query, params, options);

    res.redirect("/admin/user/all");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/admin/user/delete", async (req, res) => {
  res.render("admin-user-delete");
});

app.post("/admin/user/delete", async (req, res) => {
  try {
    console.log(req.body);

    const userId = req.body.userId;

    const query = `DELETE FROM USER_ACCOUNT
                        WHERE USER_ID = :userId`;

    const params = {
      userId: { val: userId },
    };

    const options = {
      autoCommit: true,
    };

    await connection.execute(query, params, options);

    res.redirect("/admin/user/all");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/register", async (req, res) => {
  res.render("register", { errorCode });
});

app.post("/register", async (req, res) => {
  try {
    console.log(req.body);

    const username = req.body.username;
    const phoneNo = req.body.phoneNo;
    const email = req.body.email;
    let password = req.body.password;

    console.log(username, phoneNo, email, password);
    if(connection==undefined){
      connection = await oracledb.getConnection(dbConfig);
    }

    // const query1 = `SELECT ORA_HASH('${password}') AS PASSWORD FROM DUAL`;
    // const params1 = {};
    // const result1 = await db_query(query1, params1);

    // password = result1[0].PASSWORD;
    // console.log(password);
    // console.log(result1[0].PASSWORD);

    const query = `
      INSERT INTO USER_ACCOUNT 
        (USER_ID, NAME, PHONE_NO, EMAIL, PASSWORD, DISTRICT, POSTAL_CODE, STREET) 
      VALUES (SEQ_USER.NEXTVAL, :username, :phoneNo, :email, '${password}', 'Dhaka', '1200', 'abc')`;

    const params = {
      username: { val: username },
      phoneNo: { val: phoneNo },
      email: { val: email },
    };

    const options = {
      autoCommit: true,
    };

    await connection.execute(query, params, options);

    res.redirect("/login");
  } catch (error) {
    console.log(error);
    errorCode = 3;
    res.redirect("/register");
    // res.status(500).send('Internal Server Error');
  }
});

app.get("/users/all", async (req, res) => {
  const query = "SELECT * FROM USER_ACCOUNT";
  const params = [];

  const result = await db_query(query, params);

  res.render("index", { result });
});

app.get("/login", async (req, res) => {
  res.render("login", { errorCode });

  // if (req.session.loggedIn) {
  //   res.redirect("/home");
  // } else {
  //   res.render("login", { errorCode });
  // }
});

app.get("/logout", async (req, res) => {
  // loggedIn = false;
  // user = undefined;
  // res.redirect("/home");

  req.session.destroy();
  res.redirect("/home");
});

app.post("/auth", async (req, res) => {
  // try{
  const email = req.body.email;
  const password = req.body.password;

  const query1 = `SELECT COUNT(*) AS CNT FROM USER_ACCOUNT WHERE EMAIL='${email}'`;
  const params1 = [];
  const result1 = await db_query(query1, params1);

  const bcquery1 = `SELECT COUNT(*) AS CNT FROM BUS_COMPANY WHERE EMAIL='${email}'`;
  const bcresult1 = await db_query(bcquery1, {});

  if (result1[0].CNT === 0 && bcresult1[0].CNT === 0) {
    console.log("no such user exists");
    errorCode = 1;
    res.redirect("/login");
  } else if (result1[0].CNT === 1) {
    const query = `SELECT PASSWORD FROM USER_ACCOUNT WHERE EMAIL='${email}'`;
    const params = [];
    const result = await db_query(query, params);
    if (!result[0].PASSWORD) {
      console.log("no such user exists");
      errorCode = 1;
      res.redirect("/login");
    }
    console.log(result[0].PASSWORD);

    const query2 = `SELECT ORA_HASH('${password}') AS PASSWORD FROM DUAL`;
    const params2 = [];
    const result2 = await db_query(query2, params2);
    console.log(result2[0].PASSWORD);

    if (result[0].PASSWORD === result2[0].PASSWORD.toString()) {
      console.log("log in successful");
      req.session.loggedIn = true;
      const username = `SELECT USER_ID,NAME FROM USER_ACCOUNT WHERE EMAIL='${email}'`;
      const params2 = [];
      const result2 = await db_query(username, params2);
      req.session.user = result2[0].USER_ID;
      req.session.userName = result2[0].NAME;
      console.log(req.session.user);

      // res.redirect("/home");
      if (req.session.user < 0) {
        res.redirect("/admin/home");
      } else {
        res.redirect("/home");
      }

    } else {
      console.log("incorrect credentials");
      errorCode = 2;
      res.redirect("/login");
    }
  } else {  // bus company
    const bcquery = `SELECT PASSWORD FROM BUS_COMPANY WHERE EMAIL='${email}'`;
    const bcresult = await db_query(bcquery, {});
    if (!bcresult[0].PASSWORD) {
      console.log("no such user exists");
      errorCode = 1;
      res.redirect("/login");
    }
    console.log(bcresult[0].PASSWORD);

    const bcquery2 = `SELECT ORA_HASH('${password}') AS PASSWORD FROM DUAL`;
    const bcresult2 = await db_query(bcquery2, {});
    console.log(bcresult2[0].PASSWORD);

    if (bcresult[0].PASSWORD === bcresult2[0].PASSWORD.toString()) {
      console.log("log in successful");
      req.session.busLoggedIn = true;
      const bcusername = `SELECT BUS_COMPANY_ID,BUS_COMPANY_NAME FROM BUS_COMPANY WHERE EMAIL='${email}'`;
      const bcparams2 = [];
      const bcresult2 = await db_query(bcusername, bcparams2);
      req.session.busCompanyId = bcresult2[0].BUS_COMPANY_ID;
      req.session.busCompanyName = bcresult2[0].BUS_COMPANY_NAME;
      req.session.email = email;
      console.log(req.session.busCompanyId);

      // res.redirect("/home");
      if (req.session.busCompanyId < 0) {
        res.redirect("/admin/home");
      } else {
        res.redirect("/bus-company-profile");
      }

    } else {
      console.log("incorrect credentials");
      errorCode = 2;
      res.redirect("/login");
    }
  }
});

app.get("/home", async (req, res) => {
  let profilePicResult;
  let profilePic;
  let userName;
  if(req.session.loggedIn){
    profilePicResult=await db_query(
      `SELECT *
      FROM USER_ACCOUNT
      WHERE USER_ID=${req.session.user}`,{}
    )
    profilePic=profilePicResult[0].PROFILE_PIC;
    userName=profilePicResult[0].NAME;
  }else{
    profilePic=undefined;
  }
  console.log(profilePic);

  const reviewQuery = `
    SELECT (
      SELECT NAME FROM USER_ACCOUNT WHERE USER_ID = R.USER_ID
    ) AS USER_NAME, (
      SELECT PROFILE_PIC FROM USER_ACCOUNT WHERE USER_ID=R.USER_ID
    ) AS PROFILE_PIC, 
    SCORE, COMMENTS, LAST_UPDATED_ON 
    FROM WEBSITE_REVIEW R`;
  const reviewResult = await db_query(reviewQuery, {}); 


  res.render("home", { loggedIn: req.session.loggedIn,profilePic:profilePic, userName:userName, reviewResult });
});

app.get('/bus-company-profile',async (req,res)=> {
  try {
    let busProfilePicResult;
    let busProfilePic;
    if (req.session.busLoggedIn) {
      console.log(req.session.email);
      busProfilePicResult = await db_query(
        `SELECT *
        FROM BUS_COMPANY
        WHERE EMAIL='${req.session.email}'`, {}
      )
      console.log(busProfilePicResult);
      busProfilePic = busProfilePicResult[0].BUS_RELATED_MEDIA;
    } else {
      busProfilePic = undefined;
    }

    const query = `SELECT * FROM BUS_COMPANY WHERE EMAIL='${req.session.email}'`;
    const result = await db_query(query, {});

    const busQuery = `SELECT * FROM BUS B JOIN BUS_COMPANY BC ON B.BUS_COMPANY_ID = BC.BUS_COMPANY_ID WHERE BC.EMAIL='${req.session.email}'`;
    const busResult = await db_query(busQuery, {});

    console.log(result);
    console.log(busProfilePic);

    res.render('bus-company-profile', { busLoggedIn: req.session.busLoggedIn, busProfilePic: busProfilePic, result, busResult });
  } catch (error) {
    console.log(error);
    res.status(500).send('Internal Server Error');
  }
});

app.get("/bus-company-profile/insert", async (req, res) => {
  // res.render("bus-company-profile-insert");

  // send bus company name
  const query = `SELECT BUS_COMPANY_NAME FROM BUS_COMPANY WHERE EMAIL='${req.session.email}'`;
  const params = {};
  const result = await db_query(query, params);

  console.log(result);

  res.render("bus-company-profile-insert", { result });
});

app.post("/bus-company-profile/insert", async (req, res) => {
  try {
    console.log(req.body);

    const startStandName = req.body.startStandName;
    const endStandName = req.body.endStandName;
    const intermediateStand = req.body.intermediateStand;

    let standArray = [];
    standArray.push(startStandName);
    for(let i=0;i<intermediateStand.length;i++){
      if(intermediateStand[i]!=="")
        standArray.push(intermediateStand[i]);
    }
    standArray.push(endStandName);
    
    if(connection===undefined){
      connection = await oracledb.getConnection(dbConfig);
    }

    const routeQuery = `SELECT * FROM ROUTE WHERE START_STAND_ID = GET_STAND_ID('${startStandName}') AND END_STAND_ID = GET_STAND_ID('${endStandName}')`;
    const routeResult = await db_query(routeQuery, {});

    let routeId;

    if (routeResult.length === 0) { // NEED TO INSERT ROUTE
      routeId = await connection.execute(`SELECT SEQ_ROUTE.NEXTVAL FROM DUAL`, {});
      console.log(routeId);

      const routeInsertQuery = `
        INSERT INTO ROUTE (ROUTE_ID, START_STAND_ID, END_STAND_ID) 
        VALUES (${routeId.rows[0].NEXTVAL}, 
            GET_STAND_ID(:startStandName), 
            GET_STAND_ID(:endStandName))`;
      const routeInsertParams = {
        startStandName: { val: startStandName },
        endStandName: { val: endStandName },
      };
      const routeInsertOptions = {
        autoCommit: true,
      };
      await connection.execute(routeInsertQuery, routeInsertParams, routeInsertOptions);

      await connection.execute(`INSERT INTO LOG VALUES(SEQ_LOG.NEXTVAL,'GET_STAND_ID',SYSDATE, '${startStandName}')`, {}, { autoCommit: true });

      await connection.execute(`INSERT INTO LOG VALUES(SEQ_LOG.NEXTVAL,'GET_STAND_ID',SYSDATE,'${endStandName.replace('\'', '\'\'')}')`, {}, { autoCommit: true });

      for (let i = 0; i < standArray.length; i++) {
        const standId = await connection.execute(`SELECT GET_STAND_ID('${standArray[i].replace('\'', '\'\'')}') FROM DUAL`, {});
        console.log(standId)

        const routeStandInsertQuery = `INSERT INTO ROUTE_STAND (ROUTE_STAND_ID, ROUTE_ID, STAND_ID) VALUES (SEQ_ROUTE_STAND.NEXTVAL, ${routeId.rows[0].NEXTVAL}, GET_STAND_ID('${standArray[i].replace('\'', '\'\'')}'))`;
        const routeStandInsertParams = {};
        const routeStandInsertOptions = {
          autoCommit: true,
        };

        if (connection === undefined) {
          connection = await oracledb.getConnection(dbConfig);
        }

        await connection.execute(routeStandInsertQuery, routeStandInsertParams, routeStandInsertOptions);

        await connection.execute(`INSERT INTO LOG VALUES(SEQ_LOG.NEXTVAL,'GET_STAND_ID',SYSDATE,'${standArray[i].replace('\'', '\'\'')}')`, {}, { autoCommit: true });

      } 
    } else { // ROUTE ALREADY EXISTS
      routeId = routeResult[0].ROUTE_ID;
      console.log(routeId);
    }

    let scheduleFrom = req.body.scheduleFrom;
    scheduleFrom = scheduleFrom + ':00';
    let scheduleTo = req.body.scheduleTo;
    scheduleTo = scheduleTo + ':00';
    console.log(scheduleFrom);
    console.log(scheduleTo);

    // const scheduleQuery = `SELECT * FROM SCHEDULE WHERE SCHEDULE_FROM = TO_DATE(:scheduleFrom, 'YYYY-MM-DD HH24:MI:SS') AND SCHEDULE_TO = TO_DATE(:scheduleTo, 'YYYY-MM-DD HH24:MI:SS')`;
    // const scheduleParams = {
    //   scheduleFrom: { val: scheduleFrom },
    //   scheduleTo: { val: scheduleTo },
    // };
    // const scheduleResult = await db_query(scheduleQuery, scheduleParams);
    const scheduleQuery1 = `SELECT SCHEDULE_ID FROM SCHEDULE_TIME WHERE T_TIME = interval '${scheduleFrom.toString()}' HOUR to second`;
    const scheduleResult1 = await db_query(scheduleQuery1, {});
    const scheduleQuery2 = `SELECT SCHEDULE_ID FROM SCHEDULE_TIME WHERE T_TIME = interval '${scheduleTo.toString()}' HOUR to second`;
    const scheduleResult2 = await db_query(scheduleQuery2, {});

    console.log(scheduleResult1[0].SCHEDULE_ID);
    console.log(scheduleResult2[0].SCHEDULE_ID);

    let scheduleId;

    if ((scheduleResult1.length === 0 && scheduleResult2.length === 0) || (scheduleResult1[0].SCHEDULE_ID !== scheduleResult2[0].SCHEDULE_ID)) { // NEED TO INSERT SCHEDULE
      scheduleId = await connection.execute(`SELECT SEQ_SCHEDULE.NEXTVAL FROM DUAL`, {});
      scheduleId = scheduleId.rows[0].NEXTVAL;
      console.log('insert' + scheduleId);

      const scheduleInsertQuery = `INSERT INTO SCHEDULE VALUES (${scheduleId})`;
      await connection.execute(scheduleInsertQuery, {}, { autoCommit: true });

      const scheduleTimeInsertQueryFrom = `INSERT INTO SCHEDULE_TIME VALUES (${scheduleId}, interval '${scheduleFrom.toString()}' HOUR to second)`;
      const scheduleTimeInsertQueryTo = `INSERT INTO SCHEDULE_TIME VALUES (${scheduleId}, interval '${scheduleTo.toString()}' HOUR to second)`;
      await connection.execute(scheduleTimeInsertQueryFrom, {}, { autoCommit: true });
      await connection.execute(scheduleTimeInsertQueryTo, {}, { autoCommit: true });
    } else { // SCHEDULE ALREADY EXISTS
      scheduleId = scheduleResult1[0].SCHEDULE_ID;
      console.log('dont insert ' + scheduleId);
    }

    const busCompanyName = req.body.busCompanyName;
    const busType = req.body.busType;
    const ticketPrice = req.body.ticketPrice;
    const licensePlate = req.body.licensePlate;

    console.log(busCompanyName);
    console.log(routeId);

    const seatCount = busType === 'Non-AC Bus' ? 40 : 'AC Bus' ? 32 : 20;

    // const query = `INSERT INTO BUS VALUES (SEQ_BUS.NEXTVAL, GET_BUS_COMPANY_ID(:busCompanyName), ${routeId}, ${scheduleId}, :busType, ${seatCount}, NULL, :ticketPrice, :licensePlate)`;

    const query = `
      INSERT INTO BUS 
      VALUES (SEQ_BUS.NEXTVAL, (
          SELECT BUS_COMPANY_ID FROM BUS_COMPANY 
          WHERE BUS_COMPANY_NAME=:busCompanyName
        ), ${routeId}, ${scheduleId}, :busType, ${seatCount}, 5, :ticketPrice, '${licensePlate}'
      )`;

    const params = {
      busCompanyName: { val: busCompanyName },
      busType: { val: busType },
      ticketPrice: { val: ticketPrice },
    };

    const options = {
      autoCommit: true,
    };

    if (connection === undefined) {
      connection = await oracledb.getConnection(dbConfig);
    }

    await connection.execute(query, params, options);

    res.redirect("/bus-company-profile");
  } catch (error) {
    console.log(error);
    res.status(500).send('Internal Server Error');
  }
});

app.post("/bus-company-profile/delete", async (req, res) => {
  try {
    console.log(req.body);

    const busId = req.body.busId;

    const query = `DELETE FROM BUS WHERE BUS_ID = :busId`;

    const params = {
      busId: { val: busId },
    };

    const options = {
      autoCommit: true,
    };

    if (connection === undefined) {
      connection = await oracledb.getConnection(dbConfig);
    }

    await connection.execute(query, params, options);

    res.redirect("/bus-company-profile");
  } catch (error) {
    console.log(error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/about',async(req,res)=>{
  let profilePicResult;
  let profilePic;
  let userName;
  if(req.session.loggedIn){
    profilePicResult=await db_query(
      `SELECT *
      FROM USER_ACCOUNT
      WHERE USER_ID=${req.session.user}`,{}
    )
    profilePic=profilePicResult[0].PROFILE_PIC;
    userName=profilePicResult[0].NAME;
  }else{
    profilePic=undefined;
  }
  console.log(profilePic);
  res.render('about',{loggedIn:req.session.loggedIn,profilePic:profilePic,userName:userName});
});

app.get("/routes", async function (req, res) {
  try {
    const query = `
        SELECT DISTINCT START_S.STAND_NAME AS START_STAND,
        END_S.STAND_NAME AS END_STAND, 
        D.TRAVEL_DISTANCE AS DISTANCE, 
        BC.BUS_COMPANY_NAME AS BUS_COMPANY_NAME, 
        B.BUS_TYPE, 
        D.TRAVEL_DISTANCE*B.TICKET_PRICE AS TOTAL_COST, 
        B.BUS_RATING AS BUS_RATING
        FROM BUS B 
        JOIN ROUTE R ON B.ROUTE_ID = R.ROUTE_ID
        JOIN DISTANCE D ON R.START_STAND_ID = D.STARTING_STAND AND R.END_STAND_ID= D.ENDING_STAND
        JOIN STAND START_S ON D.STARTING_STAND = START_S.STAND_ID
        JOIN STAND END_S ON D.ENDING_STAND = END_S.STAND_ID
		    JOIN BUS_COMPANY BC ON B.BUS_COMPANY_ID = BC.BUS_COMPANY_ID
        `;

    const params = [];
    const result = await db_query(query, params);
    let profilePicResult;
    let profilePic;
    let userName;
    if(req.session.loggedIn){
      profilePicResult=await db_query(
        `SELECT *
        FROM USER_ACCOUNT
        WHERE USER_ID=${req.session.user}`,{}
      )
      profilePic=profilePicResult[0].PROFILE_PIC;
      userName=profilePicResult[0].NAME;
    }else{
      profilePic=undefined;
    }
    console.log(profilePic);
    res.render("routes", { result, loggedIn: req.session.loggedIn, profilePic:profilePic,userName:userName });
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/user_profile", async function (req, res) {
  try {
    // if (loggedIn) {
    if (req.session.loggedIn) {
      const query = `SELECT * FROM USER_ACCOUNT WHERE USER_ID=${req.session.user}`;
      const params = {};
      const result = await db_query(query, params);
      console.log(result);
      const stands=await db_query(
        `SELECT STAND_NAME 
        FROM STAND`,{}
      );
      console.log(stands);
      let standArray=[];
      standArray.push(result[0].DISTRICT);
      stands.forEach(stand=>{
        stand.toString().replace('\'','\'\'');
        if(stand.STAND_NAME!=result[0].DISTRICT){
          standArray.push(stand.STAND_NAME);
        }
      })
      console.log(standArray);

      const query2 = `
      SELECT DISTINCT GET_BUS_COMPANY_NAME(BUS_ID) AS BUS_COMPANY_NAME,
      (SELECT BUS_TYPE FROM BUS WHERE BUS.BUS_ID = TICKET.BUS_ID) AS BUS_TYPE,
      GET_STAND_NAME(STARTING_STAND) AS START_STAND, 
      GET_STAND_NAME(ENDING_STAND) AS END_STAND,
      TO_CHAR(TRAVEL_TIME, 'DD MON, YYYY') AS TRAVEL_DATE,
      TO_CHAR(TRAVEL_TIME, 'HH24:MI:SS') AS TRAVEL_TIME,
      GET_SEAT_NUMBERS(USER_ID, BUS_ID, STARTING_STAND, ENDING_STAND, TRAVEL_TIME) AS SEAT_NUMBER,
      GET_TOTAL_PRICE(USER_ID, BUS_ID, STARTING_STAND, ENDING_STAND, TRAVEL_TIME) AS TICKET_PRICE
      FROM TICKET 
      WHERE USER_ID = ${req.session.user} 
      AND TRAVEL_TIME > SYSDATE
      ORDER BY TRAVEL_DATE ASC,TRAVEL_TIME ASC
      `;
      const params2 = {};
      const result2 = await db_query(query2, params2);
      console.log(result2);
      for(let i=0;i<result2.length;i++){
        await connection.execute(
          `DECLARE
            B_ID NUMBER;
          BEGIN
            SELECT BUS_ID 
            INTO B_ID
            FROM BUS 
            WHERE BUS_COMPANY_ID=
              (SELECT BUS_COMPANY_ID 
              FROM BUS_COMPANY
              WHERE BUS_COMPANY_NAME='${result2[i].BUS_COMPANY_NAME}')
            AND BUS_TYPE='${result2[i].BUS_TYPE}'
            AND SCHEDULE_ID IN
              (SELECT SCHEDULE_ID
              FROM SCHEDULE_TIME
              WHERE T_TIME=
              INTERVAL '${result2[i].TRAVEL_TIME}' HOUR TO SECOND)
            AND ROUTE_ID=
              (SELECT R1.ROUTE_ID 
              FROM (SELECT ROUTE_ID 
                FROM ROUTE_STAND 
                WHERE STAND_ID=
                  (SELECT STAND_ID 
                  FROM STAND Y
                  WHERE STAND_NAME='${result2[i].START_STAND}')) R1
                JOIN (SELECT ROUTE_ID 
                  FROM ROUTE_STAND 
                  WHERE STAND_ID=
                    (SELECT STAND_ID 
                    FROM STAND 
                    WHERE STAND_NAME='${result2[i].END_STAND}')) R2 
                ON R1.ROUTE_ID=R2.ROUTE_ID);
            INSERT INTO LOG VALUES(SEQ_LOG.NEXTVAL,'GET_BUS_COMPANY_NAME',SYSDATE,B_ID);
            INSERT INTO LOG VALUES(SEQ_LOG.NEXTVAL,'GET_STAND_NAME',SYSDATE,'${result2[i].START_STAND}');
            INSERT INTO LOG VALUES(SEQ_LOG.NEXTVAL,'GET_STAND_NAME',SYSDATE,'${result2[i].END_STAND}');
            INSERT INTO LOG VALUES(SEQ_LOG.NEXTVAL,'GET_SEAT_NUMBERS',SYSDATE,'${req.session.user}'||', '||B_ID||', '||'${result2[i].START_STAND}'||', '||'${result2[i].END_STAND}'||', '||'${result2[i].TRAVEL_TIME}');
            INSERT INTO LOG VALUES(SEQ_LOG.NEXTVAL,'GET_TOTAL_PRICE',SYSDATE,'${req.session.user}'||', '||B_ID||', '||'${result2[i].START_STAND}'||', '||'${result2[i].END_STAND}'||', '||'${result2[i].TRAVEL_TIME}');
            COMMIT;
          END;`,{

          }
        )
      }

      const query3 = `
      SELECT DISTINCT GET_BUS_COMPANY_NAME(BUS_ID) AS BUS_COMPANY_NAME,
      (SELECT BUS_TYPE FROM BUS WHERE BUS.BUS_ID = TICKET.BUS_ID) AS BUS_TYPE,
      GET_STAND_NAME(STARTING_STAND) AS START_STAND, GET_STAND_NAME(ENDING_STAND) AS END_STAND,
      TO_CHAR(TRAVEL_TIME, 'DD MON, YYYY') AS TRAVEL_DATE,
      TO_CHAR(TRAVEL_TIME, 'HH24:MI:SS') AS TRAVEL_TIME,
      GET_SEAT_NUMBERS(USER_ID, BUS_ID, STARTING_STAND, ENDING_STAND, TRAVEL_TIME) AS SEAT_NUMBER,
      GET_TOTAL_PRICE(USER_ID, BUS_ID, STARTING_STAND, ENDING_STAND, TRAVEL_TIME) AS TICKET_PRICE
      FROM TICKET WHERE USER_ID = ${req.session.user} AND TRAVEL_TIME < SYSDATE
      ORDER BY TRAVEL_DATE DESC,TRAVEL_TIME DESC
      `;
      const params3 = {};
      const result3 = await db_query(query3, params3);
      console.log(result3);
      for(let i=0;i<result3.length;i++){
        await connection.execute(
          `DECLARE
            B_ID NUMBER;
          BEGIN
            SELECT BUS_ID 
            INTO B_ID
            FROM BUS 
            WHERE BUS_COMPANY_ID=
              (SELECT BUS_COMPANY_ID 
              FROM BUS_COMPANY
              WHERE BUS_COMPANY_NAME='${result3[i].BUS_COMPANY_NAME}')
            AND BUS_TYPE='${result3[i].BUS_TYPE}'
            AND SCHEDULE_ID=
              (SELECT SCHEDULE_ID
              FROM SCHEDULE_TIME
              WHERE T_TIME=
              INTERVAL '${result3[i].TRAVEL_TIME}' HOUR TO SECOND)
            AND ROUTE_ID=
              (SELECT R1.ROUTE_ID 
              FROM (SELECT ROUTE_ID 
                FROM ROUTE_STAND 
                WHERE STAND_ID=
                  (SELECT STAND_ID 
                  FROM STAND Y
                  WHERE STAND_NAME='${result3[i].START_STAND}')) R1
                JOIN (SELECT ROUTE_ID 
                  FROM ROUTE_STAND 
                  WHERE STAND_ID=
                    (SELECT STAND_ID 
                    FROM STAND 
                    WHERE STAND_NAME='${result3[i].END_STAND}')) R2 
                ON R1.ROUTE_ID=R2.ROUTE_ID);
            INSERT INTO LOG VALUES(SEQ_LOG.NEXTVAL,'GET_BUS_COMPANY_NAME',SYSDATE,B_ID);
            INSERT INTO LOG VALUES(SEQ_LOG.NEXTVAL,'GET_STAND_NAME',SYSDATE,'${result3[i].START_STAND}');
            INSERT INTO LOG VALUES(SEQ_LOG.NEXTVAL,'GET_STAND_NAME',SYSDATE,'${result3[i].END_STAND}');
            INSERT INTO LOG VALUES(SEQ_LOG.NEXTVAL,'GET_SEAT_NUMBERS',SYSDATE,'${req.session.user}'||', '||B_ID||', '||'${result3[i].START_STAND}'||', '||'${result3[i].END_STAND}'||', '||'${result3[i].TRAVEL_TIME}');
            INSERT INTO LOG VALUES(SEQ_LOG.NEXTVAL,'GET_TOTAL_PRICE',SYSDATE,'${req.session.user}'||', '||B_ID||', '||'${result3[i].START_STAND}'||', '||'${result3[i].END_STAND}'||', '||'${result3[i].TRAVEL_TIME}');
            COMMIT;
          END;`,{

          }
        )
      }

      const query4 = `SELECT TICKET_ID FROM TICKET WHERE USER_ID = ${req.session.user} AND TRAVEL_TIME > SYSDATE`;
      const params4 = {};
      const result4 = await db_query(query4, params4);
      const prevTripBusIdQuery=`SELECT DISTINCT BUS_ID FROM TICKET WHERE USER_ID=${req.session.user} AND TRAVEL_TIME < SYSDATE`;
      const prevTripBusIdParams={};
      const prevTripBusIdResult=await db_query(prevTripBusIdQuery,prevTripBusIdParams);
      console.log(prevTripBusIdResult);
      let prevReviews=[];
      for(let i=0;i<prevTripBusIdResult.length;i++){
        const prevReviewQuery=`SELECT * FROM REVIEW WHERE USER_ID=${req.session.user} AND BUS_ID=${prevTripBusIdResult[i].BUS_ID}`;
        const prevReviewParams={};
        const prevReviewResult=await db_query(prevReviewQuery,prevReviewParams);
        console.log(prevReviewResult);
        if(prevReviewResult.length==0){
          prevReviews.push({USER_ID:req.session.user,BUS_ID:prevTripBusIdResult[i].BUS_ID,COMMENTS:'',SCORE:''});
        }else{
          prevReviews.push(prevReviewResult[0]);
        }
      }
      let reviewObj=[];
      for(let i=0;i<result3.length;i++){
        let busIdQueryResult=await db_query(
          `SELECT BUS_ID 
            FROM BUS 
            WHERE BUS_COMPANY_ID=
              (SELECT BUS_COMPANY_ID 
              FROM BUS_COMPANY
              WHERE BUS_COMPANY_NAME='${result3[i].BUS_COMPANY_NAME}')
            AND BUS_TYPE='${result3[i].BUS_TYPE}'
            AND SCHEDULE_ID=
              (SELECT SCHEDULE_ID
              FROM SCHEDULE_TIME
              WHERE T_TIME=
              INTERVAL '${result3[i].TRAVEL_TIME}' HOUR TO SECOND)
            AND ROUTE_ID=
              (SELECT R1.ROUTE_ID 
              FROM (SELECT ROUTE_ID 
                FROM ROUTE_STAND 
                WHERE STAND_ID=
                  (SELECT STAND_ID 
                  FROM STAND Y
                  WHERE STAND_NAME='${result3[i].START_STAND}')) R1
                JOIN (SELECT ROUTE_ID 
                  FROM ROUTE_STAND 
                  WHERE STAND_ID=
                    (SELECT STAND_ID 
                    FROM STAND 
                    WHERE STAND_NAME='${result3[i].END_STAND}')) R2 
                ON R1.ROUTE_ID=R2.ROUTE_ID)`,{}
        )
        console.log(busIdQueryResult);
        console.log('prev reviews')
        console.log(prevReviews)
        let busId=busIdQueryResult[0].BUS_ID;
        for(let j=0;j<prevReviews.length;j++){
          console.log(prevReviews[j].BUS_ID)
          if(prevReviews[j].BUS_ID==busId){
            reviewObj.push(prevReviews[j]);
          }
        }
      }
      console.log(result3.length);
      console.log('review obj');
      console.log(reviewObj)
      let profilePicResult;
      let profilePic;
      let userName;
      if(req.session.loggedIn){
        profilePicResult=await db_query(
          `SELECT *
          FROM USER_ACCOUNT
          WHERE USER_ID=${req.session.user}`,{}
        )
        profilePic=profilePicResult[0].PROFILE_PIC;
        userName=profilePicResult[0].NAME;
      }else{
        profilePic=undefined;
      }
      console.log(profilePic);

      const query6 = `SELECT * FROM WEBSITE_REVIEW WHERE USER_ID=${req.session.user}`;
      const result6 = await db_query(query6, {});
      console.log(result6);
      if(result6.length==0){
        result6.push({
          USER_ID:req.session.user,
          COMMENTS:'',
          SCORE:'0'
        })
      }

      res.render("user-profile", {
        result,
        result2,
        result3,
        result4,
        result5:reviewObj,
        result6,
        stands:standArray,
        loggedIn: req.session.loggedIn,
        profilePic:profilePic,
        userName: userName
      });
    } else {
      res.redirect("/login");
    }
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

app.post('/user_profile/profile_pic_change',async (req,res)=>{
  try{
    console.log(req.body.filePath);
    res.redirect('/user_profile');
    if(connection===undefined){
      connection=await oracledb.getConnection(dbConfig);
    }
    await connection.execute(
      `UPDATE USER_ACCOUNT
      SET PROFILE_PIC='${req.body.filePath}'
      WHERE USER_ID=${req.session.user}`,{},{
        autoCommit:true
      }
    )
  }catch(error){
    console.log(error);
    res.status(500).send('Internal Server Error');
  }
})

app.post("/user_profile/delete_ticket", async function (req, res) {
  try {
    console.log(req.body);
    const busCompanyName = req.body.busCompanyName;
    const busType = req.body.busType;
    const startingStand = req.body.startingStand;
    const endingStand = req.body.endingStand;
    const travelDate = req.body.travelDate;
    const travelTime = req.body.travelTime;
    const seatNumber = req.body.seatNumber;
    const date=travelDate[0]+travelDate[1];
    const month=travelDate[3]+travelDate[4]+travelDate[5];
    const year=travelDate[8]+travelDate[9]+travelDate[10]+travelDate[11];
    console.log(date);
    console.log(month);
    console.log(year);
    const travelDateTime=`${year}-${month}-${date} ${travelTime}`;
    const seatNumberArray = seatNumber.split(", ");
    console.log(
      busCompanyName,
      busType,
      startingStand,
      endingStand,
      travelDate,
      travelTime,
      seatNumber,
      seatNumberArray,
      travelDateTime
    );
    const scheduleIdQuery=`SELECT SCHEDULE_ID FROM SCHEDULE_TIME WHERE LPAD(EXTRACT(HOUR FROM T_TIME),2,'0')=${parseInt(travelTime.split(":")[0])}`;
    // const routeIdQuery=`SELECT ROUTE_ID FROM ROUTE_STAND WHERE STAND_ID=(SELECT STAND_ID FROM STAND WHERE STAND_NAME='${startingStand}')`;
    const routeIdQuery=`
    SELECT R1.ROUTE_ID
    FROM ROUTE_STAND R1
    JOIN ROUTE_STAND R2 
    ON R1.STAND_ID=(
      SELECT STAND_ID
      FROM STAND 
      WHERE STAND_NAME='${startingStand}')
    AND R2.STAND_ID=(
      SELECT STAND_ID
      FROM STAND 
      WHERE STAND_NAME='${endingStand}')
    AND R1.ROUTE_ID=R2.ROUTE_ID`
    const params={};
    const scheduleIdResult=await db_query(scheduleIdQuery,params);
    console.log(scheduleIdResult)
    const routeIdResult=await db_query(routeIdQuery,params);
    console.log(routeIdResult)
    // const busIdQuery=`SELECT BUS_ID FROM BUS WHERE BUS_COMPANY_ID=(SELECT BUS_COMPANY_ID FROM BUS_COMPANY WHERE BUS_COMPANY_NAME='${busCompanyName}') AND BUS_TYPE='${busType}' AND ROUTE_ID=${routeIdResult[0].ROUTE_ID} AND SCHEDULE_ID=${scheduleIdResult[0].SCHEDULE_ID} AND BUS_TYPE='${busType}'` ;
    const busIdQuery=`
    SELECT BUS_ID 
      FROM BUS 
      WHERE BUS_COMPANY_ID=
        (SELECT BUS_COMPANY_ID 
        FROM BUS_COMPANY
        WHERE BUS_COMPANY_NAME='${busCompanyName}')
      AND BUS_TYPE='${busType}'
      AND SCHEDULE_ID=
        (SELECT SCHEDULE_ID
        FROM SCHEDULE_TIME
        WHERE T_TIME=
        INTERVAL '${travelTime}' HOUR TO SECOND)
      AND ROUTE_ID=
        (SELECT R1.ROUTE_ID 
        FROM (SELECT ROUTE_ID 
          FROM ROUTE_STAND 
          WHERE STAND_ID=
            (SELECT STAND_ID 
            FROM STAND Y
            WHERE STAND_NAME='${startingStand}')) R1
          JOIN (SELECT ROUTE_ID 
            FROM ROUTE_STAND 
            WHERE STAND_ID=
              (SELECT STAND_ID 
              FROM STAND 
              WHERE STAND_NAME='${endingStand}')) R2 
          ON R1.ROUTE_ID=R2.ROUTE_ID)
    `
    const busIdResult=await db_query(busIdQuery,params);
    console.log(busIdResult);
    for (let i = 0; i < seatNumberArray.length; i++) {
      const ticketIdQuery = `SELECT TICKET_ID FROM  TICKET WHERE USER_ID=${req.session.user} AND BUS_ID=${busIdResult[0].BUS_ID} AND TRAVEL_TIME=TO_DATE('${travelDateTime}','YYYY-MON-DD HH24:MI:SS') AND SEAT_NUMBER='${seatNumberArray[i]}'`;
      const params={};
      const ticketIdResult=await db_query(ticketIdQuery,params);
      console.log(ticketIdResult);
      const deleteQuery = `DELETE FROM TICKET WHERE TICKET_ID=${ticketIdResult[0].TICKET_ID}`;
      const options={
        autoCommit:true
      };
      await db_query(deleteQuery, params,options);
    }

    res.redirect("/user_profile");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/user_profile/update", async function (req, res) {
  try {
    console.log(req.body);
    const username = req.body.username;
    const phoneNo = req.body.phoneNo;
    const email = req.body.email;
    const house = req.body.house;
    const street = req.body.street;
    const district = req.body.district;
    const postalCode = req.body.postalCode;

    const query = `
      UPDATE USER_ACCOUNT 
      SET NAME = :username, 
      PHONE_NO = :phoneNo, 
      EMAIL = :email, 
      HOUSE = :house, 
      STREET = :street, 
      DISTRICT = :district, 
      POSTAL_CODE = :postalCode, 
      LAST_UPDATED_ON = SYSDATE 
      WHERE USER_ID = ${req.session.user}`;
    const params = {
      username: { val: username },
      phoneNo: { val: phoneNo },
      email: { val: email },
      house: { val: house },
      street: { val: street },
      district: { val: district },
      postalCode: { val: postalCode },
    };

    const options = {
      autoCommit: true,
    };

    await connection.execute(query, params, options);

    res.redirect("/user_profile");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/user_profile/review", async function (req, res) {
  try {
    console.log(req.body);
    const busCompanyName = req.body.busCompanyName;
    const busType = req.body.busType;
    const startingStand = req.body.startingStand;
    const endingStand = req.body.endingStand;
    const stars=req.body.starCount;
    // const rating = req.body.rating;
    const review = req.body.review;
    const travelTime=req.body.travelTime;
    console.log(travelTime)
    console.log(stars);

    const checkQuery=`
    SELECT * 
    FROM REVIEW 
    WHERE USER_ID = ${req.session.user}
    AND BUS_ID = (
        SELECT BUS_ID 
        FROM BUS 
        WHERE BUS_COMPANY_ID = (
            SELECT BUS_COMPANY_ID 
            FROM BUS_COMPANY
            WHERE BUS_COMPANY_NAME = '${busCompanyName}'
        )
        AND BUS_TYPE = '${busType}'
        AND SCHEDULE_ID = (
            SELECT SCHEDULE_ID
            FROM SCHEDULE_TIME
            WHERE T_TIME = INTERVAL '${travelTime}' HOUR TO SECOND
        )
        AND ROUTE_ID = (
            SELECT R1.ROUTE_ID 
            FROM (
                SELECT ROUTE_ID 
                FROM ROUTE_STAND 
                WHERE STAND_ID = (
                    SELECT STAND_ID 
                    FROM STAND Y
                    WHERE STAND_NAME = '${startingStand}'
                )
            ) R1
            JOIN (
                SELECT ROUTE_ID 
                FROM ROUTE_STAND 
                WHERE STAND_ID = (
                    SELECT STAND_ID 
                    FROM STAND 
                    WHERE STAND_NAME = '${endingStand}'
                )
            ) R2 ON R1.ROUTE_ID = R2.ROUTE_ID
        )
    )
`
    const checkParams={};
    const checkResult=await db_query(checkQuery,checkParams);
    console.log(checkResult);

    let query;
    let params;
    let flag=false;
    if(checkResult.length==0){
      query = `
        INSERT INTO REVIEW 
        VALUES(${req.session.user}, 
          (SELECT BUS_ID FROM BUS WHERE BUS_COMPANY_ID = 
            (SELECT BUS_COMPANY_ID FROM BUS_COMPANY 
              WHERE BUS_COMPANY_NAME = :busCompanyName )
            AND BUS_TYPE = :busType 
            AND ROUTE_ID = 
              (SELECT ROUTE_ID FROM ROUTE WHERE 
                  (
                    START_STAND_ID <= GET_STAND_ID(:startingStand) 
                    AND END_STAND_ID >= GET_STAND_ID(:endingStand) 
                  ) 
              )
          ), ${stars}, :review)`;
      params = {
        busCompanyName: { val: busCompanyName },
        busType: { val: busType },
        startingStand: { val: startingStand },
        endingStand: { val: endingStand },
        // rating: { val: rating },
        review: { val: review },
      };
    }else{
      query=`UPDATE REVIEW SET SCORE=${stars}, COMMENTS='${review}',LAST_UPDATED_ON=SYSDATE WHERE USER_ID=${req.session.user} AND BUS_ID=${checkResult[0].BUS_ID}`;
      params={};
      flag=true;
    }    

    const options = {
      autoCommit: true,
    };
    console.log(flag);
    await connection.execute(query, params, options);
    // if(flag){
    //   await connection.execute(
    //     `BEGIN
    //       UPDATE_RATING_TEMP_INSERT(${checkResult[0].BUS_ID});
    //     END;`,{}
    //   )
    // }
    res.redirect("/user_profile");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/user_profile/website_review", async function (req, res) {
  try {
    console.log(req.body);

    const stars = req.body.starCount;
    const review = req.body.review;

    console.log(stars);
    console.log(review);

    const checkQuery = `SELECT * FROM WEBSITE_REVIEW WHERE USER_ID = ${req.session.user}`;
    const checkResult = await db_query(checkQuery, {});
    console.log(checkResult);

    let query;
    let params={}
    let flag = false;
    if (checkResult.length == 0) {
      query = `INSERT INTO WEBSITE_REVIEW VALUES(${req.session.user}, ${stars}, '${review}',SYSDATE,SYSDATE)`;
      params = {
        
      };
    } else {
      query = `UPDATE WEBSITE_REVIEW SET SCORE=${stars}, COMMENTS='${review}', LAST_UPDATED_ON=SYSDATE WHERE USER_ID=${req.session.user}`;
      flag = true;
    }

    const options = { autoCommit: true };

    await connection.execute(query, params, options);

    res.redirect("/user_profile");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/search", async function (req, res) {
  try {
    const result = []; // Initialize result variable
    let profilePicResult;
    let profilePic;
    let userName;
    if(req.session.loggedIn){
      profilePicResult=await db_query(
        `SELECT *
        FROM USER_ACCOUNT
        WHERE USER_ID=${req.session.user}`,{}
      )
      profilePic=profilePicResult[0].PROFILE_PIC;
      userName=profilePicResult[0].NAME;
    }else{
      profilePic=undefined;
    }
    const busCompany=await db_query(
      `SELECT BUS_COMPANY_NAME
      FROM BUS_COMPANY`,{}
    )
    console.log(busCompany);
    console.log(profilePic);
    res.render("search", { result,busCompany, loggedIn: req.session.loggedIn ,profilePic:profilePic,userName: userName});
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/search_with_param", async (req, res) => {
  try {
    console.log("in app.post");
    console.log(req.body);

    const startStandName = req.body.startStandName;
    const endStandName = req.body.endStandName;
    let busCompany = req.body.busCompany;
    let busType = req.body.busType;
    let profilePicResult;
    let profilePic;
    let userName;
    if(req.session.loggedIn){
      profilePicResult=await db_query(
        `SELECT *
        FROM USER_ACCOUNT
        WHERE USER_ID=${req.session.user}`,{}
      )
      profilePic=profilePicResult[0].PROFILE_PIC;
      req.session.userName=profilePicResult[0].NAME;
    }else{
      profilePic=undefined;
    }
    const busCompanyNames=await db_query(
      `SELECT BUS_COMPANY_NAME
      FROM BUS_COMPANY`,{}
    )
    if(startStandName==endStandName){
      console.log('same');
      res.render("search", {result:[], busCompany:busCompanyNames,loggedIn: req.session.loggedIn ,profilePic:profilePic,userName:userName});
    }
    if(busType===''){
      busType='%';
    }
    if(busCompany===''){
      busCompany='%';
    }
    console.log('busType',busType)
    console.log('busCompany',busCompany)

    // const query = `
    //     SELECT START_S.STAND_NAME AS START_STAND, END_S.STAND_NAME AS END_STAND, D.TRAVEL_DISTANCE AS DISTANCE, B.BUS_TYPE, D.TRAVEL_DISTANCE*B.TICKET_PRICE AS TOTAL_COST, BC.BUS_COMPANY_NAME
    //     FROM BUS B JOIN ROUTE R ON B.ROUTE_ID = R.ROUTE_ID
    //         JOIN DISTANCE D ON R.START_STAND_ID = D.STARTING_STAND AND R.END_STAND_ID = D.ENDING_STAND
    //         JOIN STAND START_S ON D.STARTING_STAND = START_S.STAND_ID
    //         JOIN STAND END_S ON D.ENDING_STAND = END_S.STAND_ID
    //         JOIN BUS_COMPANY BC ON BC.BUS_COMPANY_ID = B.BUS_COMPANY_ID
    //         WHERE
    //             START_S.STAND_NAME LIKE '%${startStandName}%'
    //             AND END_S.STAND_NAME LIKE '%${endStandName}%'
    //             AND BC.BUS_COMPANY_NAME LIKE '%${busCompany}%'
    //             AND B.BUS_TYPE LIKE '%${busType}%'
    //     `;
    const query = `
      SELECT 
        (SELECT TRAVEL_DISTANCE
        FROM DISTANCE
        WHERE STARTING_STAND=
          (SELECT STAND_ID
          FROM STAND
          WHERE STAND_NAME='${startStandName}')
        AND ENDING_STAND=
          (SELECT STAND_ID
          FROM STAND
          WHERE STAND_NAME='${endStandName}')
        ) AS DISTANCE,
        TICKET_PRICE,
        BUS_RATING,
        BUS_TYPE,
        (SELECT BUS_RELATED_MEDIA
        FROM BUS_COMPANY BC
        WHERE BC.BUS_COMPANY_ID=B.BUS_COMPANY_ID) AS BUS_RELATED_MEDIA,
        (SELECT BUS_COMPANY_NAME
        FROM BUS_COMPANY BC
        WHERE BC.BUS_COMPANY_ID=B.BUS_COMPANY_ID) AS BUS_COMPANY_NAME
      FROM BUS B
      WHERE B.BUS_COMPANY_ID IN
          (SELECT BUS_COMPANY_ID
          FROM BUS_COMPANY
          WHERE BUS_COMPANY_NAME LIKE '${busCompany}')
      AND BUS_TYPE LIKE '${busType}'
      AND ROUTE_ID=
        (SELECT RS1.ROUTE_ID
        FROM ROUTE_STAND RS1
        JOIN ROUTE_STAND RS2
        ON RS1.STAND_ID=
          (SELECT STAND_ID
          FROM STAND
          WHERE STAND_NAME='${startStandName}')
        AND RS2.STAND_ID=
          (SELECT STAND_ID
          FROM STAND
          WHERE STAND_NAME='${endStandName}')
        AND RS1.ROUTE_ID=RS2.ROUTE_ID)
    `;

    const params = {};

    const result = await db_query(query, params);
    let resultObj=[];
    for(let i=0;i<result.length;i++){
      resultObj.push({
        START_STAND:startStandName,
        END_STAND:endStandName,
        DISTANCE:result[i].DISTANCE,
        BUS_TYPE:result[i].BUS_TYPE,
        TOTAL_COST:result[i].DISTANCE*result[i].TICKET_PRICE,
        BUS_COMPANY_NAME:result[i].BUS_COMPANY_NAME,
        BUS_RELATED_MEDIA:result[i].BUS_RELATED_MEDIA,
        BUS_RATING:result[i].BUS_RATING
      })
    }

    console.log("after query");
    console.log(result);
    console.log(resultObj)
    console.log(profilePic);
    res.render("search", { result:resultObj,busCompany:busCompanyNames, loggedIn: req.session.loggedIn ,profilePic:profilePic,userName:userName});
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/booking", async function (req, res) {
  let profilePicResult;
  let profilePic;
  let userName;
  if(req.session.loggedIn){
    profilePicResult=await db_query(
      `SELECT *
      FROM USER_ACCOUNT
      WHERE USER_ID=${req.session.user}`,{}
    )
    profilePic=profilePicResult[0].PROFILE_PIC;
    userName=profilePicResult[0].NAME;
  }else{
    profilePic=undefined;
  }
  console.log(profilePic);
  res.render("booking", { loggedIn: req.session.loggedIn,profilePic:profilePic ,userName:userName});
});

app.post("/booking_with_param", async function (req, res) {
  try {
    let profilePicResult;
      let profilePic;
      let userName;
      if(req.session.loggedIn){
        profilePicResult=await db_query(
          `SELECT *
          FROM USER_ACCOUNT
          WHERE USER_ID=${req.session.user}`,{}
        )
        profilePic=profilePicResult[0].PROFILE_PIC;
        userName=profilePicResult[0].NAME;
      }else{
        profilePic=undefined;
      }
      console.log(profilePic);
    const startStandName = req.body.startStandName;
    let endStandName = req.body.endStandName;
    endStandName = endStandName.replace('\'', '\'\'');
    if(startStandName===endStandName){
      res.render("booking", { loggedIn: req.session.loggedIn,profilePic:profilePic,userName:userName });
    }
    // const busCompany = req.body.busCompany;
    const date = req.body.date;
    const time = req.body.time;
    const busType = req.body.busType;
    console.log(startStandName);
    console.log(endStandName);
    console.log(date);
    console.log(time);
    const travel_time = date + " " + time + ":00";
    console.log(busType);
    let currDate = new Date();
    console.log(currDate);
    const day = currDate.getDate().toString().padStart(2, "0");
    const month = (currDate.getMonth() + 1).toString().padStart(2, "0");
    const year = currDate.getFullYear();
    const currHour = currDate.getHours();
    const hour = time.split(":")[0];
    console.log(hour);
    currDate = `${year}-${month}-${day}`;
    if (date < currDate || (hour < currHour && date === currDate)) {
      res.render("booking", { loggedIn: req.session.loggedIn ,profilePic:profilePic,userName:userName});
    } else {
      const distanceQuery = `
        SELECT D.TRAVEL_DISTANCE AS DIST 
        FROM DISTANCE D 
        WHERE D.STARTING_STAND=
          (SELECT STAND_ID FROM STAND 
            WHERE STAND_NAME='${startStandName}') 
          AND D.ENDING_STAND=(SELECT STAND_ID FROM STAND 
            WHERE STAND_NAME='${endStandName}')`;

      const routeId=await db_query(`
      SELECT R1.ROUTE_ID 
      FROM ROUTE_STAND R1
      JOIN ROUTE_STAND R2 
      ON R1.STAND_ID=(
        SELECT STAND_ID 
        FROM STAND
        WHERE STAND_NAME='${startStandName}')
      AND R2.STAND_ID=(
        SELECT STAND_ID 
        FROM STAND 
        WHERE STAND_NAME='${endStandName}')
      AND R1.ROUTE_ID=R2.ROUTE_ID`,{});
      console.log(routeId)
      let route;
      if (
        routeId === undefined 
      ) {
        res.render("booking", { loggedIn: req.session.loggedIn,profilePic:profilePic,userName:userName });
      } else {
        route = routeId[0].ROUTE_ID;
      }
      console.log(route);
      //!
      //! following is being added to use bus ids
      // const busIdQuery = `SELECT B.*,BC.BUS_COMPANY_NAME
      //       FROM BUS B JOIN BUS_COMPANY BC ON B.BUS_COMPANY_ID = BC.BUS_COMPANY_ID
      //       WHERE B.BUS_TYPE='${busType}' AND B.ROUTE_ID=${parseInt(
      //   route
      // )} AND B.SCHEDULE_ID=(SELECT SCHEDULE_ID FROM SCHEDULE_TIME WHERE LPAD(EXTRACT(HOUR FROM T_TIME),2,'0')=${parseInt(
      //   hour
      // )})`;

      const busIdQuery = `SELECT B.*,
      (SELECT BUS_COMPANY_NAME
      FROM BUS_COMPANY BC
      WHERE BC.BUS_COMPANY_ID=B.BUS_COMPANY_ID) AS BUS_COMPANY_NAME,
      (SELECT BUS_RELATED_MEDIA
        FROM BUS_COMPANY BC
        WHERE BC.BUS_COMPANY_ID=B.BUS_COMPANY_ID) AS BUS_RELATED_MEDIA
      FROM BUS B
      WHERE BUS_TYPE='${busType}'
      AND SCHEDULE_ID IN
        (SELECT SCHEDULE_ID
        FROM SCHEDULE_TIME
        WHERE T_TIME=
        INTERVAL '${time+":00"}' HOUR TO SECOND)
      AND ROUTE_ID=
        (SELECT RS1.ROUTE_ID
        FROM ROUTE_STAND RS1
        JOIN ROUTE_STAND RS2
        ON RS1.STAND_ID=
          (SELECT STAND_ID
          FROM STAND 
          WHERE STAND_NAME='${startStandName}')
        AND RS2.STAND_ID=
          (SELECT STAND_ID
          FROM STAND
          WHERE STAND_NAME='${endStandName}')
        AND RS1.ROUTE_ID=RS2.ROUTE_ID)`
      const busIdQueryParams = {};
      const busIdResult = await db_query(busIdQuery, busIdQueryParams);
      if (busIdResult === undefined || busIdResult.length === 0) {
        res.render("booking", { loggedIn: req.session.loggedIn,profilePic:profilePic,userName:userName });
      }
      //!
      const params = {};
      const distanceResult = await db_query(distanceQuery, params);
      console.log(busIdResult);
      console.log(distanceResult);
      //! newly added event query
      const eventQuery = `
        SELECT * FROM EVENT 
          WHERE DISCOUNT=(
            SELECT MAX(DISCOUNT) FROM EVENT 
            WHERE EVENT_START_TIME<=TO_DATE('${date}','YYYY-MM-DD') 
            AND EVENT_END_TIME>=TO_DATE('${date}','YYYY-MM-DD')
          )
      AND EVENT_START_TIME<=TO_DATE('${date}','YYYY-MM-DD') 
      AND EVENT_END_TIME>=TO_DATE('${date}','YYYY-MM-DD')`;
      const eventQueryParams = {};
      const eventResult = await db_query(eventQuery, eventQueryParams);
      if (eventResult.length === 0) {
        event = {
          EVENT_ID: -1,
          DISCOUNT: 0,
        };
        eventResult.push(event);
      }
      console.log(eventResult);
      //!
      //   const priceResult = await db_query(priceQuery, params);
      //   const total_cost = distanceResult[0].DIST * priceResult[0].TICKET_PRICE;
      //   console.log(total_cost);
      const result = [
        {
          START_STAND: startStandName,
          END_STAND: endStandName,
          DISTANCE: distanceResult[0].DIST,
          BUS_TYPE: busType,
          //   TOTAL_COST: total_cost,
          //   BUS_COMPANY_NAME: busCompany,
          DISCOUNT: eventResult[0],
        },
      ];

      let seatRemaining = [];
      for (let i = 0; i < busIdResult.length; i++) {

        const query3 = `SELECT SEAT_NUMBER
                FROM TICKET
                WHERE BUS_ID=${busIdResult[i].BUS_ID} AND TRAVEL_TIME=TO_DATE('${travel_time}','YYYY-MM-DD HH24:MI:SS') `;
        const params3 = {};
        const result3 = await db_query(query3, params3);
        console.log(result3);
        seatRemaining.push({
          REMAINING_SEAT: busIdResult[i].SEAT_COUNT - result3.length,
        });
      }
      console.log(seatRemaining);

      console.log(result);
      
      res.render("booking-comparisons", {
        result,
        date,
        time,
        busIdResult,
        seatRemaining,
        // bookedSeats,
        loggedIn: req.session.loggedIn,
        profilePic:profilePic,
        userName:userName
      });
    }
  } catch (e) {
    console.log(e);
  }
});

app.post("/booking/seat", async function (req, res) {
  try {
    const startStandName = req.body.startStandName;
    const endStandName = req.body.endStandName;
    const busCompany = req.body.busCompany;
    const date = req.body.date;
    const time = req.body.time;
    const busType = req.body.busType;
    console.log(startStandName);
    console.log(endStandName);
    console.log(date);
    console.log(time);
    console.log(busType);
    console.log(busCompany);
    let currDate = new Date();
    console.log(currDate);
    const day = currDate.getDate().toString().padStart(2, "0");
    const month = (currDate.getMonth() + 1).toString().padStart(2, "0");
    const year = currDate.getFullYear();
    const currHour = currDate.getHours();
    const hour = time.split(":")[0];
    console.log(hour);
    currDate = `${year}-${month}-${day}`;
    if (date < currDate || (hour < currHour && date === currDate)) {
      res.render("booking", { loggedIn: req.session.loggedIn });
    } else {
      const distanceQuery = `
        SELECT D.TRAVEL_DISTANCE AS DIST 
        FROM DISTANCE D 
        WHERE D.STARTING_STAND=(
          SELECT STAND_ID FROM STAND WHERE STAND_NAME='${startStandName}'
        ) AND D.ENDING_STAND=(
          SELECT STAND_ID FROM STAND WHERE STAND_NAME='${endStandName}'
        )`;
      const priceQuery = `
            SELECT TICKET_PRICE FROM BUS B
            JOIN BUS_COMPANY BC ON B.BUS_COMPANY_ID = BC.BUS_COMPANY_ID
            WHERE B.BUS_TYPE='${busType}' AND BC.BUS_COMPANY_NAME='${busCompany}'
            `;

      const routeId=await db_query(`
      SELECT R1.ROUTE_ID 
      FROM ROUTE_STAND R1
      JOIN ROUTE_STAND R2 
      ON R1.STAND_ID=(
        SELECT STAND_ID 
        FROM STAND
        WHERE STAND_NAME='${startStandName}')
      AND R2.STAND_ID=(
        SELECT STAND_ID 
        FROM STAND 
        WHERE STAND_NAME='${endStandName}')
      AND R1.ROUTE_ID=R2.ROUTE_ID`,{});
      console.log(routeId)
      let route;
      let profilePicResult;
      let profilePic;
      let userName;
      if(req.session.loggedIn){
        profilePicResult=await db_query(
          `SELECT *
          FROM USER_ACCOUNT
          WHERE USER_ID=${req.session.user}`,{}
        )
        profilePic=profilePicResult[0].PROFILE_PIC;
        userName=profilePicResult[0].NAME;
      }else{
        profilePic=undefined;
      }
      console.log(profilePic);
      if (
        routeId === undefined
      ) {
        res.render("booking", { loggedIn: req.session.loggedIn,profilePic:profilePic,userName:userName });
      } else {
        route = routeId[0].ROUTE_ID;
      }
      console.log(route);
      //!
      //! following is being added to use bus ids
      // const busIdQuery = `SELECT BUS_ID
      //       FROM BUS
      //       WHERE BUS_COMPANY_ID=(SELECT BUS_COMPANY_ID FROM BUS_COMPANY WHERE BUS_COMPANY_NAME='${busCompany}')
      //       AND BUS_TYPE='${busType}' AND ROUTE_ID=${parseInt(
      //   route
      // )} AND SCHEDULE_ID=(SELECT SCHEDULE_ID FROM SCHEDULE_TIME WHERE LPAD(EXTRACT(HOUR FROM T_TIME),2,'0')=${parseInt(
      //   hour
      // )})`;
      const busIdQuery = `SELECT B.*,
      (SELECT BUS_COMPANY_NAME
      FROM BUS_COMPANY BC
      WHERE BC.BUS_COMPANY_ID=B.BUS_COMPANY_ID) AS BUS_COMPANY_NAME
      FROM BUS B
      WHERE BUS_TYPE='${busType}'
      AND SCHEDULE_ID IN
        (SELECT SCHEDULE_ID
        FROM SCHEDULE_TIME
        WHERE T_TIME=
        INTERVAL '${time+":00"}' HOUR TO SECOND)
      AND ROUTE_ID=
        (SELECT RS1.ROUTE_ID
        FROM ROUTE_STAND RS1
        JOIN ROUTE_STAND RS2
        ON RS1.STAND_ID=
          (SELECT STAND_ID
          FROM STAND 
          WHERE STAND_NAME='${startStandName}')
        AND RS2.STAND_ID=
          (SELECT STAND_ID
          FROM STAND
          WHERE STAND_NAME='${endStandName}')
        AND RS1.ROUTE_ID=RS2.ROUTE_ID)`
      const busIdQueryParams = {};
      const busIdResult = await db_query(busIdQuery, busIdQueryParams);
      if (busIdResult.length === 0) {
        res.render("booking", { loggedIn: req.session.loggedIn,profilePic:profilePic,userName:userName });
      }
      //!
      const params = {};
      const distanceResult = await db_query(distanceQuery, params);
      console.log(busIdResult);
      console.log(distanceResult);
      //! newly added event query
      const eventQuery = `SELECT * FROM EVENT WHERE DISCOUNT=(SELECT MAX(DISCOUNT) FROM EVENT WHERE EVENT_START_TIME<=TO_DATE('${date}','YYYY-MM-DD') AND EVENT_END_TIME>=TO_DATE('${date}','YYYY-MM-DD'))
      AND EVENT_START_TIME<=TO_DATE('${date}','YYYY-MM-DD') AND EVENT_END_TIME>=TO_DATE('${date}','YYYY-MM-DD')`;
      const eventQueryParams = {};
      const eventResult = await db_query(eventQuery, eventQueryParams);
      if (eventResult.length === 0) {
        event = {
          EVENT_ID: -1,
          DISCOUNT: 0,
        };
        eventResult.push(event);
      }
      console.log(eventResult);
      //!
      const priceResult = await db_query(priceQuery, params);
      const total_cost = distanceResult[0].DIST * priceResult[0].TICKET_PRICE;
      console.log(total_cost);
      const result = [
        {
          START_STAND: startStandName,
          END_STAND: endStandName,
          DISTANCE: distanceResult[0].DIST,
          BUS_TYPE: busType,
          TOTAL_COST: total_cost,
          BUS_COMPANY_NAME: busCompany,
          DISCOUNT: eventResult[0],
        },
      ];
      // const query3=`SELECT SEAT_NUMBER
      // FROM TICKET
      // WHERE BUS_ID=${busIdResult[0].BUS_COMPANY_ID} AND STARTING_STAND=(SELECT STAND_ID FROM STAND WHERE STAND_NAME='${startStandName}') AND ENDING_STAND=(SELECT STAND_ID FROM STAND WHERE STAND_NAME='${endStandName}') AND TRAVEL_TIME=TO_DATE('${date}','YYYY-MM-DD') `
      //!the following has been newly added
      const query3 = `SELECT SEAT_NUMBER
                FROM TICKET
                WHERE BUS_ID=${busIdResult[0].BUS_ID} AND TRAVEL_TIME=TO_DATE('${date} ${time}:00','YYYY-MM-DD HH24:MI:SS') `;
      //!
      // const query3=`SELECT SEAT_NUMBER
      // FROM TICKET
      // WHERE BUS_ID=${busIdResult[0].BUS_COMPANY_ID} AND TRAVEL_TIME=TO_DATE('${date}','YYYY-MM-DD')`
      console.log(result);
      const params3 = {};
      const result3 = await db_query(query3, params3);
      console.log(result3);
      const bookedSeats = [];
      result3.forEach((res) => {
        bookedSeats.push(res.SEAT_NUMBER);
      });
      console.log(bookedSeats);
      res.render("bookingCard", {
        result,
        date,
        time,
        bookedSeats,
        loggedIn: req.session.loggedIn,
        profilePic:profilePic,
        userName: userName
      });
    }
  } catch (e) {
    console.log(e);
  }
});

app.post("/routes/book", async function (req, res) {
  if (req.session.user === undefined) {
    res.redirect("/login");
  }
  console.log("body");
  console.log(req.body);
  const startStandName = req.body.startStandName;
  const endStandName = req.body.endStandName;
  const busCompany = req.body.busCompany;
  const date = req.body.date;
  const time = req.body.time;
  const busType = req.body.busType;
  const price = parseFloat(req.body.discount).toFixed(2);
  const event_id = req.body.event_id;
  let seatNumbers = req.body.seatNumbers.split(",");
  console.log(startStandName);
  console.log(endStandName);
  console.log(date);
  console.log(time);
  console.log(busType);
  console.log(req.session.user);
  console.log(seatNumbers);
  const travel_time = date + " " + time + ":00";
  console.log(travel_time);
  // const result=[user,startStandName,endStandName,busCompany,date,time,busType];
  //   const query1 = `SELECT SEQ_TRANSACTION.NEXTVAL FROM DUAL`;
  //   const params1 = [];
  //   const result1 = await db_query(query1, params1);
  //   console.log(result1);
  //   const query = `INSERT INTO TRANSACTION VALUES(${result1[0].NEXTVAL},SYSDATE, ${price})`;
  //   const params = [];
  const options = { autoCommit: true };
  //   await connection.execute(query, params, options);
  // const busIdQuery=`SELECT BUS_COMPANY_ID FROM BUS_COMPANY WHERE BUS_COMPANY_NAME='${busCompany}'`;
  //!
  const scheduleIdQuery = `SELECT SCHEDULE_ID FROM SCHEDULE_TIME WHERE LPAD(EXTRACT(HOUR FROM T_TIME),2,'0')=${time[0]+time[1]}`;
  const scheduleIdQueryParams = {};
  const scheduleIdResult = await db_query(scheduleIdQuery, scheduleIdQueryParams);
  console.log(scheduleIdResult);
  // const busIdQuery = `SELECT BUS_ID
  //           FROM BUS
  //           WHERE BUS_COMPANY_ID=(SELECT BUS_COMPANY_ID FROM BUS_COMPANY WHERE BUS_COMPANY_NAME='${busCompany}')
  //           AND BUS_TYPE='${busType}' AND ROUTE_ID=(SELECT ROUTE_ID FROM ROUTE_STAND WHERE STAND_ID=(SELECT STAND_ID FROM STAND WHERE STAND_NAME='${startStandName}')) AND SCHEDULE_ID=${scheduleIdResult[0].SCHEDULE_ID}`;
  const busIdQuery = `
  SELECT BUS_ID 
    FROM BUS 
    WHERE BUS_COMPANY_ID=
      (SELECT BUS_COMPANY_ID 
      FROM BUS_COMPANY
      WHERE BUS_COMPANY_NAME='${busCompany}')
    AND BUS_TYPE='${busType}'
    AND SCHEDULE_ID IN
      (SELECT SCHEDULE_ID
      FROM SCHEDULE_TIME
      WHERE T_TIME=
      INTERVAL '${time+":00"}' HOUR TO SECOND)
    AND ROUTE_ID=
      (SELECT R1.ROUTE_ID 
      FROM (SELECT ROUTE_ID 
        FROM ROUTE_STAND 
        WHERE STAND_ID=
          (SELECT STAND_ID 
          FROM STAND Y
          WHERE STAND_NAME='${startStandName}')) R1
        JOIN (SELECT ROUTE_ID 
          FROM ROUTE_STAND 
          WHERE STAND_ID=
            (SELECT STAND_ID 
            FROM STAND 
            WHERE STAND_NAME='${endStandName}')) R2 
        ON R1.ROUTE_ID=R2.ROUTE_ID)`
  //!
  const busIdQueryParams = {};
  const busIdResult = await db_query(busIdQuery, busIdQueryParams);
  // const query3=`SELECT SEAT_NUMBER
  //         FROM TICKET
  //         WHERE BUS_ID=${busIdResult[0].BUS_COMPANY_ID} AND TRAVEL_TIME=TO_DATE('${date}','YYYY-MM-DD')`
  //!the following has been newly added
  const query3 = `SELECT SEAT_NUMBER
        FROM TICKET
        WHERE BUS_ID=${busIdResult[0].BUS_ID} AND TRAVEL_TIME=TO_DATE('${travel_time}','YYYY-MM-DD HH24:MI:SS') `;
  //!
  const params3 = {};
  const result3 = await db_query(query3, params3);
  console.log(result3);
  const bookedSeats = [];
  result3.forEach((res) => {
    bookedSeats.push(res.SEAT_NUMBER);
  });
  let seatNumbersArray = [];
  for (let i = 0; i < seatNumbers.length; i++) {
    if (!bookedSeats.includes(seatNumbers[i])) {
      seatNumbersArray.push(seatNumbers[i]);
    }
  }
  seatNumbers = seatNumbersArray;
  for (let i = 0; i < seatNumbers.length; i++) {
    //!changed
    const query1 = `SELECT SEQ_TRANSACTION.NEXTVAL FROM DUAL`;
    const params1 = [];
    const result1 = await db_query(query1, params1);
    console.log(result1);
    let query2;
    if (event_id == -1) {
      query2 = `INSERT INTO TICKET(TICKET_ID,USER_ID,BUS_ID,TRANSACTION_ID,STARTING_STAND,ENDING_STAND,DISTANCE_ID,TRAVEL_TIME,SEAT_NUMBER,TICKET_PRICE)
        VALUES(SEQ_TICKET.NEXTVAL,
        ${req.session.user},${busIdResult[0].BUS_ID},
        ${result1[0].NEXTVAL},
        (SELECT STAND_ID FROM STAND WHERE STAND_NAME='${startStandName}'),
        (SELECT STAND_ID FROM STAND WHERE STAND_NAME='${endStandName}'),
        (SELECT D.DISTANCE_ID FROM  STAND S1 CROSS JOIN STAND S2 JOIN DISTANCE D ON (S1.STAND_ID=D.STARTING_STAND AND S2.STAND_ID=D.ENDING_STAND) WHERE S1.STAND_ID=(SELECT STAND_ID FROM STAND WHERE STAND_NAME='${startStandName}') AND S2.STAND_ID=(SELECT STAND_ID FROM STAND WHERE STAND_NAME='${endStandName}')),
        TO_DATE('${travel_time}','YYYY-MM-DD HH24:MI:SS'),
        '${seatNumbers[i]}',${price})`;
    } else {
      query2 = `INSERT INTO TICKET(TICKET_ID,USER_ID,BUS_ID,TRANSACTION_ID,STARTING_STAND,ENDING_STAND,DISTANCE_ID,TRAVEL_TIME,SEAT_NUMBER,TICKET_PRICE,EVENT_ID)
        VALUES(SEQ_TICKET.NEXTVAL,
        ${req.session.user},${busIdResult[0].BUS_ID},
        ${result1[0].NEXTVAL},
        (SELECT STAND_ID FROM STAND WHERE STAND_NAME='${startStandName}'),
        (SELECT STAND_ID FROM STAND WHERE STAND_NAME='${endStandName}'),
        (SELECT D.DISTANCE_ID FROM  STAND S1 CROSS JOIN STAND S2 JOIN DISTANCE D ON (S1.STAND_ID=D.STARTING_STAND AND S2.STAND_ID=D.ENDING_STAND) WHERE S1.STAND_ID=(SELECT STAND_ID FROM STAND WHERE STAND_NAME='${startStandName}') AND S2.STAND_ID=(SELECT STAND_ID FROM STAND WHERE STAND_NAME='${endStandName}')),
        TO_DATE('${travel_time}','YYYY-MM-DD HH24:MI:SS'),
        '${seatNumbers[i]}',${price},${event_id})`;
    }
    const params2 = {};
    await connection.execute(query2, params2, options);
  }

  res.redirect("/home");
});

app.post("/admin/indv_company_stats", async (req, res) => {
  const busCompanyName = req.body.busCompany;
  if(connection===undefined){
    connection=await oracledb.getConnection(dbConfig);
  }
  console.log(busCompanyName);
  const busCompanyInfo = `SELECT * FROM BUS_COMPANY WHERE BUS_COMPANY_NAME='${busCompanyName}'`;
  const ticketInfo = `SELECT * FROM TICKET T JOIN BUS B ON T.BUS_ID=B.BUS_ID JOIN BUS_COMPANY BC ON BC.BUS_COMPANY_ID=B.BUS_COMPANY_ID WHERE BC.BUS_COMPANY_NAME='${busCompanyName}'`;
  // const revenue = `SELECT REVENUE('${busCompanyName}') AS REVENUE FROM DUAL`;
  const revenue=await connection.execute(
    `BEGIN
      GET_BUS_COMPANY_REVENUE(\'${busCompanyName}\',:REVENUE);
      END;`,{
        REVENUE:{dir:oracledb.BIND_OUT,type:oracledb.NUMBER}
      }
  )
  const rating = await connection.execute(
    `BEGIN 
      GET_BUS_COMPANY_RATING(\'${busCompanyName}\',:RATING);
    END;`,{
      RATING:{dir:oracledb.BIND_OUT,type:oracledb.NUMBER}
    }
  )
  const revenuePerMonth = `
    SELECT SUM(T.TICKET_PRICE) AS REVENUE,
    TO_CHAR(TRAVEL_TIME,'MONTH') AS MONTH 
    FROM TICKET T 
    JOIN BUS B ON T.BUS_ID=B.BUS_ID 
    JOIN BUS_COMPANY BC ON BC.BUS_COMPANY_ID=B.BUS_COMPANY_ID 
    WHERE BC.BUS_COMPANY_NAME='${busCompanyName}' 
    GROUP BY TO_CHAR(TRAVEL_TIME,'MONTH')`;
  const ticketSells = `
    SELECT COUNT(T.TICKET_ID) AS TICKETS_SOLD,
    TO_CHAR(TRAVEL_TIME,'MONTH') AS MONTH 
    FROM TICKET T 
    JOIN BUS B ON T.BUS_ID=B.BUS_ID 
    JOIN BUS_COMPANY BC ON BC.BUS_COMPANY_ID=B.BUS_COMPANY_ID 
    WHERE BC.BUS_COMPANY_NAME='${busCompanyName}' 
    GROUP BY TO_CHAR(TRAVEL_TIME,'MONTH')`;
  const params = {};
  const busCompanyInfoResult = await db_query(busCompanyInfo, params);
  const ticketInfoResult = await db_query(ticketInfo, params);
  const revenuePerMonthResult = await db_query(revenuePerMonth, params);
  const ticketSellsResult = await db_query(ticketSells, params);
  console.log(ticketInfoResult);
  const result = {
    busCompanyInfo: busCompanyInfoResult,
    ticketInfo: ticketInfoResult,
    revenue: [{REVENUE:revenue.outBinds.REVENUE}],
    rating: [{RATING:rating.outBinds.RATING}],
    revenuePerMonth: revenuePerMonthResult,
    ticketSells: ticketSellsResult,
  };
  console.log(result);

  // bus reviews
  const reviewQuery = `
    SELECT 
      (SELECT NAME FROM USER_ACCOUNT WHERE USER_ID = R.USER_ID) AS USER_NAME, 
      (SELECT PROFILE_PIC FROM USER_ACCOUNT WHERE USER_ID=R.USER_ID) AS PROFILE_PIC, 
      SCORE, COMMENTS,
      LAST_UPDATED_ON 
      FROM REVIEW R 
      WHERE BUS_ID IN 
        (SELECT BUS_ID FROM BUS WHERE BUS_COMPANY_ID=
          (SELECT BUS_COMPANY_ID FROM BUS_COMPANY 
            WHERE BUS_COMPANY_NAME='${busCompanyName}'))`;

  const reviewResult = await db_query(reviewQuery, params);

  res.render("admin-indv-company-stats", { result, reviewResult });
});

app.post("/bus-company-profile/stats", async (req, res) => {
    console.log(req.body.busCompanyName)
    const busCompanyName = req.body.busCompanyName;
    console.log('bus company profile stats');
    if(connection===undefined){
        connection=await oracledb.getConnection(dbConfig);
      }
      console.log(busCompanyName);
      const busCompanyInfo = `SELECT * FROM BUS_COMPANY WHERE BUS_COMPANY_NAME='${busCompanyName}'`;
      const ticketInfo = `
        SELECT * FROM TICKET T 
        JOIN BUS B ON T.BUS_ID=B.BUS_ID 
        JOIN BUS_COMPANY BC ON BC.BUS_COMPANY_ID=B.BUS_COMPANY_ID 
        WHERE BC.BUS_COMPANY_NAME='${busCompanyName}'`;
      // const revenue = `SELECT REVENUE('${busCompanyName}') AS REVENUE FROM DUAL`;
      const revenue=await connection.execute(
        `BEGIN
          GET_BUS_COMPANY_REVENUE(\'${busCompanyName}\',:REVENUE);
          END;`,{
            REVENUE:{dir:oracledb.BIND_OUT,type:oracledb.NUMBER}
          }
      )
      const rating = await connection.execute(
        `BEGIN 
          GET_BUS_COMPANY_RATING(\'${busCompanyName}\',:RATING);
        END;`,{
          RATING:{dir:oracledb.BIND_OUT,type:oracledb.NUMBER}
        }
      )
      const revenuePerMonth = `
        SELECT SUM(T.TICKET_PRICE) AS REVENUE,
        TO_CHAR(TRAVEL_TIME,'MONTH') AS MONTH 
        FROM TICKET T 
        JOIN BUS B ON T.BUS_ID=B.BUS_ID 
        JOIN BUS_COMPANY BC ON BC.BUS_COMPANY_ID=B.BUS_COMPANY_ID 
        WHERE BC.BUS_COMPANY_NAME='${busCompanyName}' 
        GROUP BY TO_CHAR(TRAVEL_TIME,'MONTH')`;
      const ticketSells = `
        SELECT COUNT(T.TICKET_ID) AS TICKETS_SOLD,
        TO_CHAR(TRAVEL_TIME,'MONTH') AS MONTH 
        FROM TICKET T 
        JOIN BUS B ON T.BUS_ID=B.BUS_ID 
        JOIN BUS_COMPANY BC ON BC.BUS_COMPANY_ID=B.BUS_COMPANY_ID 
        WHERE BC.BUS_COMPANY_NAME='${busCompanyName}' 
        GROUP BY TO_CHAR(TRAVEL_TIME,'MONTH')`;
      const params = {};
      const busCompanyInfoResult = await db_query(busCompanyInfo, params);
      const ticketInfoResult = await db_query(ticketInfo, params);
      const revenuePerMonthResult = await db_query(revenuePerMonth, params);
      const ticketSellsResult = await db_query(ticketSells, params);
      console.log(ticketInfoResult);
      const result = {
        busCompanyInfo: busCompanyInfoResult,
        ticketInfo: ticketInfoResult,
        revenue: [{REVENUE:revenue.outBinds.REVENUE}],
        rating: [{RATING:rating.outBinds.RATING}],
        revenuePerMonth: revenuePerMonthResult,
        ticketSells: ticketSellsResult,
      };
      console.log(result);
    
      // bus reviews
      const reviewQuery = `
        SELECT 
          (SELECT NAME FROM USER_ACCOUNT WHERE USER_ID = R.USER_ID) AS USER_NAME,
          (SELECT PROFILE_PIC FROM USER_ACCOUNT WHERE USER_ID=R.USER_ID) AS PROFILE_PIC, 
          SCORE, COMMENTS,LAST_UPDATED_ON 
          FROM REVIEW R 
          WHERE BUS_ID IN 
            (SELECT BUS_ID FROM BUS WHERE BUS_COMPANY_ID=
              (SELECT BUS_COMPANY_ID FROM BUS_COMPANY 
                WHERE BUS_COMPANY_NAME='${busCompanyName}'))`;
    
      const reviewResult = await db_query(reviewQuery, params);
      let busProfilePicResult;
      let busProfilePic;
      if (req.session.busLoggedIn) {
      console.log(req.session.email);
      busProfilePicResult = await db_query(
          `SELECT *
          FROM BUS_COMPANY
          WHERE EMAIL='${req.session.email}'`, {}
      )
      console.log(busProfilePicResult);
      busProfilePic = busProfilePicResult[0].BUS_RELATED_MEDIA;
      } else {
      busProfilePic = undefined;
      }
      const query = `SELECT * FROM BUS_COMPANY WHERE EMAIL='${req.session.email}'`;
      const result1 = await db_query(query, {});
    
      res.render("bus-company-profile-stats", {busLoggedIn:req.session.busLoggedIn,
        busProfilePic:busProfilePic, result,result1, reviewResult });
});

// TODO: add intermediate stops
// TODO: add intermediate page to select bus company, showing price comparisons, may show total and available seats, might omit bus type in previous selection, buttons in the cards for directing to seat selection
// TODO: add schedule/time to ticket for segregating the tickets booked for the same bus but for different timings
// TODO: reviews
// TODO: pl sql
// TODO: user profile(optional)
// TODO: error handling, passing error codes, showing alerts
// TODO: add time in insert of ticket
// TODO: consider stands in some order, maybe one time they go forward, for the second schedule order is reversed

// TODO: show comments with score for the comapnies

// ! CONSIDER USING NEGATIVE USER ID FOR ADMIN

// TODO: change search
  // ? may include searching for different types in user side
// TODO: routes follow order
// TODO: round the rating in cards
// TODO: fix and add more plsql code
// TODO: try to find more analytics
// TODO: manage log table:
  // ! may use plsql blocks o insert into the table, whenver function or procedure is called
// ! multiple users logged in at the same time, does the user id variable malfunction

// ! new day, new error: login with multiple users, user variable gets reassigned and all serve the same user that is the last one
  // TODO: probable solution: pass user_id from route to route, ...too much to do

// TODO: admin side all insert,delete,update
// TODO: cascading delete actions 
// TODO: new actions for spanning tables 
// TODO: error handling 
// TODO: implement session or JWT 
// TODO: WEBISTE REVIEW FROM USER
// TODO: home page suggestions

// TODO: PREPARE TRIGGER FILE 
// TODO: PREPARE FUCNTION FILE
// TODO: INSERTS?

// TODO: past trips, upcoming trips ordering
// ! WARNING: 
    // !!! DO NOT ADD ROUTES THAT CONTAIN STANDS ALREADY IN THE SAME ROUTE
// TODO: ADD DELETE TRANSACTION TRIGGER
