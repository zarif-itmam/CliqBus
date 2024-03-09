const express = require('express');
const cors = require('cors');
const oracledb = require('oracledb');
oracledb.outFormat = oracledb.OBJECT;
var path = require('path');
const bodyParser=require("body-parser");

const app = express(); 
app.use(cors());
app.options('*', cors());
app.use(express.json());
app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

app.listen(5000, () => {
    console.log('Server running on port 5000');
});

const dbConfig = {
    user: 'CLIQBUS',
    password: 'CLIQBUS',
    connectionString: 'localhost/orcl',
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

app.get('/users/all', async (req, res) => {
    const query = 'SELECT * FROM USER_ACCOUNT';
    const params = [];

    const result = await db_query(query, params);

    res.render('index', {result});
});

app.get('/login', async (req, res) => {

    res.render('login');
});

app.post('/auth', async (req, res) =>{
    // try{
        const email=req.body.email;
        const password=req.body.password;
        const query1=`SELECT COUNT(*) AS CNT FROM USER_ACCOUNT WHERE EMAIL='${email}'`;
        const params1 = [];
        const result1 = await db_query(query1, params1);
        if(result1[0].CNT===0){
            console.log('no such user exists');
            res.redirect('/login');
        }
        else{
            const query=`SELECT PASSWORD FROM USER_ACCOUNT WHERE EMAIL='${email}'`;
            const params = [];
            const result = await db_query(query, params);
            if(!result[0].PASSWORD){
                console.log('no such user exists');
                res.redirect('/login');
            }
            console.log(result[0].PASSWORD)
            if(result[0].PASSWORD===password){
                console.log('log in successful')
            /

                res.redirect('/routes');
                // res.render('routes')

            }else{
                console.log('incorrect credentials');
                res.redirect('/login');
            }
        }
});

app.get('/routes', async function(req, res) {
    try {        
        const query = `SELECT START_S.STAND_NAME AS START_STAND, END_S.STAND_NAME AS END_STAND, D.TRAVEL_DISTANCE AS DISTANCE, B.BUS_TYPE, D.TRAVEL_DISTANCE*P.COST AS TOTAL_COST
        FROM BUS B JOIN ROUTE R ON B.ROUTE_ID = R.ROUTE_ID
        JOIN DISTANCE D ON R.START_STAND_ID = D.STARTING_STAND AND R.END_STAND_ID= D.ENDING_STAND
        JOIN PRICE P ON B.BUS_TYPE = P.BUS_TYPE
        JOIN STAND START_S ON D.STARTING_STAND = START_S.STAND_ID
        JOIN STAND END_S ON D.ENDING_STAND = END_S.STAND_ID
        `;
        
        const params = [];
        const result = await db_query(query, params);

        res.render('routes', { result }); 
    
    } catch (error) {
        console.log(error);
        res.status(500).send('Internal Server Error');
    }
});


