const express = require('express');
const app = express();
const port = 3000;
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({extended:false}));
const { body, validationResult } = require("express-validator");

//items in the global namespace are accessible throught out the node application
global.db = new sqlite3.Database('./database.db',function(err){
  if(err){
    console.error(err);
    process.exit(1); //Bail out we can't connect to the DB
  }else{
    console.log("Database connected");
    global.db.run("PRAGMA foreign_keys=ON"); //This tells SQLite to pay attention to foreign key constraints
  }
});


//set routes dir
const userRoutes = require('./routes/user');
const authorRoutes = require('./routes/author');

//view engine Setup
app.set("views",__dirname + "/views");
app.set('view engine', 'ejs');
const urlEncodedParser = bodyParser.urlencoded({extended:false});
app.engine("html", require("ejs").renderFile);
app.use(express.static(__dirname + '/views'));

//this adds all the userRoutes to the app under the path /route
app.use('/', userRoutes);
app.use('/auth', authorRoutes);
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

