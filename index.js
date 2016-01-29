var express = require('express');

var mongodb = require('mongodb');
var mongo = require('mongodb').MongoClient;
var bodyParser = require('body-parser');
var session = require('client-sessions'); //CITATION: Sessions: https://stormpath.com/blog/everything-you-ever-wanted-to-know-about-node-dot-js-sessions/
var ObjectId = require('mongodb').ObjectID;
var nodemailer = require('nodemailer'); //CITATION Email notifications: https://nodemailer.com/
var bcrypt = require('bcrypt');

var uri = "mongodb://admin:password@ds039135.mongolab.com:39135/heroku_lfhmjwj6";
var lastTime = 0; 

var app = express();
var db = null;

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

//whenever new session starts, clear cookies
app.use(session({
  cookieName: 'session',
  //high entropy string to encode/decode cookies
  secret: 'weoirdfbxlkqpelwhfsseksm129575',
  duration: 30 * 60 * 1000,
  //keeps session running 5 minutes after last click
  activeDuration: 5 * 60 * 1000,
  httpOnly: true,
  secure: true,
  ephemeral: true
}));

app.use(function(req, res, next) {
  var usersCollection = db.collection('users'); 
  if (req.session && req.session.user) {
    usersCollection.findOne({"username": req.session.user['username'] }, function(err, user) {
      if (user) {
        req.user = user;
        delete req.user.password; // delete the password from the session
        //format is { _id: 5691889a13b90b0300ec85b7, username: 'braswell@mit.edu' }
        req.session.user = user;  //refresh the session value 
        //req.session.user["lastTime"] = 0; 
        res.locals.user = user;
      }
      // finishing processing the middleware and run the route
      next();
    });
  } else {
    next();
  }
});

var smtpConfig = {
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // use SSL
    auth: {
        user: 'ihtfyp@gmail.com',
        pass: 'alwaysblue'
    }
};
var transporter = nodemailer.createTransport(smtpConfig);

//implement option?
app.post('/logout', function(req, res) {
  req.session.reset(); 
  res.send('clear_cookies_success');
});

function requireLogin (req, res, next) {
  if (!req.user) {
    res.redirect('/');
    //or render?
  } else {
    next();
  }
};

app.get('/', function(request, response) {
  response.render('pages/index');
});

 app.get('/start_page', requireLogin, function(request, response) {
    response.render('pages/start_page', {
      username: request.session.user['username']
    });
    //cookies are stored
 });

 app.get('/dashboard',  function(request, response) {
    response.render('pages/dashboard', {
      username: request.session.user['username']
    });
 });

 app.get('/visualization',  function(request, response) {
    response.render('pages/visualization', {
      username: request.session.user['username']
    });
 });

app.listen(app.get('port'), function() {
  //console.log('Node app is running on port', app.get('port'));
});

mongo.connect(uri, function(err, dbRes) {
	//console.log("connected to database");

	db = dbRes;
});


app.post('/getlostmappins', function(req, res, next) {

      var lostCollection = db.collection('lost');   

      lostCollection.find().toArray(function (err1, result1) {
        if (err1) {
          console.log(err1);
        } 
        else {
            res.send(result1);
        }
      });
});

app.post('/getfoundmappins', function(req, res, next) {

      var foundCollection = db.collection('found');   

      foundCollection.find().toArray(function (err, result) {
        if (err) {
          console.log(err);
        } 
        else {
            res.send(result);
        }
      });
});

app.post('/getlostviz', function(req, res, next) {
      var lostCollection = db.collection('lost');   
      lostCollection.find().toArray(function (err, result) {
        if (err) {
          console.log(err);
        } 
        else {
            res.send(result);
        }
      });
});

app.post('/getfoundviz', function(req, res, next) {
      var foundCollection = db.collection('found');   
      foundCollection.find().toArray(function (err, result) {
        if (err) {
          console.log(err);
        } 
        else {
            res.send(result);
        }
      });
});



app.post('/checkuser', function(req, res, next) {

	var userName = req.body.username;
	var passWord = req.body.password;

	var usersCollection = db.collection('users'); 

	usersCollection.find({username: userName}).toArray(function (err, result) {
      if (err) {
        console.log(err);
      } 
      else if (result.length) {
        var hash = result[0]['password']; 
        bcrypt.compare(passWord, hash, function(err, hashres) {
            if(hashres) {
              req.session.user = result[0];
              //req.session.user["lastTime"] = 0; 
              //console.log(JSON.stringify(req.session.user) + " THIS IS THE USER......");
              res.send("start_page");
            }
            else {
              res.send('Wrong password');
            }
        });
      } 
      else {
        res.send("No user with that username"); 
      }
  	}); 
});


app.post('/adduser', function (req, res, next) {
	// Catching variables passed in the form
	var userName = req.body.username;
	var passWord = req.body.password;

	var usersCollection = db.collection('users'); 	
	
  usersCollection.find({username: userName}).toArray(function (err, result) {
    if (err) {
      console.log(err);
    } 
    else if (result.length) {
      res.send("username_exists"); 
    } 
    else {
      //Adding the new entry to the db
      bcrypt.genSalt(10, function(err, salt) {
        bcrypt.hash(passWord, salt, function(err, hash) {
          // Store hash in your password DB.
          usersCollection.insert({
                "username" : userName,
                "password" : hash,
                "lost_list" : [],
                "found_list" : []
            }, function (err, insertResult) {
              // Send back a success message
              usersCollection.find({username: userName}).toArray(function (err, result) {
                if (err) { //error
                  console.log(err);
                } 
                else if (result.length) { //found user we just entered
                  req.session.user = result[0];
                  //req.session.user["lastTime"] = 0; 
                  res.send('username_added');
                } 
                else { //oops
                }
              }); 
          }); 
        });
      });
    }
  });  
});

//CITATION Geocoding: https://developers.google.com/maps/documentation/javascript/geocoding and https://developers.google.com/maps/documentation/javascript/examples/geocoding-simple
//CITATIOn Distance between two points: http://stackoverflow.com/questions/1502590/calculate-distance-between-two-points-in-google-maps-v3
//stack overflow code
var rad = function(x) {
  return x * Math.PI / 180;
};

//stack overflow code
//p1 = [lat,lng]
var getDistance = function(p1, p2) {
  var R = 6378137; // Earth’s mean radius in meter
  var dLat = rad(p2[0] - p1[0]);
  var dLong = rad(p2[1] - p1[1]);
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rad(p1[0])) * Math.cos(rad(p2[0])) *
    Math.sin(dLong / 2) * Math.sin(dLong / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c;
  return d; // returns the distance in meter
};

//insert new lost form, update lost form's found_matches_list if possible, update those found forms lost_matches_lists
app.post('/addlostform', function (req, res, next) {
  var usersCollection = db.collection('users');   
  var lostCollection = db.collection('lost');   
  var foundCollection = db.collection('found');  
  //console.log("THIS IS THE USER!!!!! " + JSON.stringify(req.session.user)); 
  username = req.session.user["username"];
  //lastTime = req.session.user["lastTime"];
  // var d = new Date();
  // var currTime = d.getTime()/60000;
  // var prevTime = lastTime; 
  // //req.session.user["lastTime"] = num_min; 
  // console.log(prevTime + "LOST PREV TIME!!!!!!!!!!");
  // console.log(currTime + "LOST CURR TIME!!!!!!!!!!!!");

  // lastTime = currTime; 

  // if (currTime - prevTime < 1) {
  //     //have a pop up saying you can only submit one form a minute pls no spam
  //     console.log("LESS THAN ONE MINUTE!!!!!");
  //     res.send("spam");
  // }
  //else {
    var final_found_matches_list = []
    //add a new lost form
    var new_lost_item = {
              "username" : username,
              "item_category" : req.body.item_category,
              "item_subcategory": req.body.item_subcategory,
              "item_location": [req.body.item_lat,req.body.item_lng],
              "found_matches_list": [],
              "recovered" : false
    };
    lostCollection.insert(new_lost_item, function (err, insertResult) {
      if (err) { //error
        console.log(err);
      } 
      else { 
        var lost_form_id = new_lost_item._id
        //go through all found forms and find possible matches
        //add id of lost form to all potential found forms 'lost_matches_list'
        //add ids of all found forms to the 'found_matches_list' of the lost item
        foundCollection.find({"item_category":req.body.item_category,"item_subcategory":req.body.item_subcategory }).toArray(function (err, result) {
            if (err) {
              console.log(err);
            } 
            else {
              //res.send(JSON.stringify(result));
              for(var i = 0; i < result.length; i++) {
                  var distance = 0;
                  if ((result[i]['item_location'][0] !== "none") && (req.body.item_lat !== "none")){
                      var found_location = [parseFloat(result[i]['item_location'][0]),parseFloat(result[i]['item_location'][1])];
                      var lost_location = [parseFloat(req.body.item_lat),parseFloat(req.body.item_lng)];
                      distance = getDistance(found_location,lost_location);
                    }          
                  if (distance < 804){ //meters of .5 mile
                    var object_fun = {}
                    object_fun[result[i]['_id']] = "red";
                    final_found_matches_list.push(object_fun);    
                    //find previous lost_list of found forms
                    prev_list = result[i]["lost_matches_list"];
                    new_dict = {};
                    new_dict[lost_form_id] = "gray";
                    prev_list.push(new_dict);
                    foundCollection.update(
                        { "_id": result[i]["_id"]},
                          {
                           $set: {
                             "lost_matches_list": prev_list
                           }
                        }
                    );
                  }
              }
        //update the lost_collection with new found_matches_list
        //onsole.log("finalasdfasdf " + final_found_matches_list);
        lostCollection.update(
                        { "_id": lost_form_id},
                          {
                           $set: {
                             "found_matches_list": final_found_matches_list
                           }
                        }
        );
        //update the user's data to include that form's id in list
        usersCollection.find({username: username}).toArray(function (err, result) {
        if (err) {
            console.log(err);
          } 
        else {
            var prev_list = result[0]['lost_list']
            prev_list.push(lost_form_id)
            usersCollection.update(
              { "username": username },
                {
                 $set: {
                   "lost_list": prev_list
                 }
              }
                );
             }           
           });
            }
        });
      }
    });
  //}
});


app.post('/addfoundform', function (req, res, next) {
   var usersCollection = db.collection('users');   
  var lostCollection = db.collection('lost');   
  var foundCollection = db.collection('found');   
  username = req.session.user["username"];

  // var d = new Date();
  // var currTime = d.getTime()/60000;
  // var prevTime = lastTime; 

  // console.log(prevTime + "FOUND PREV TIME!!!!!!!!!!");
  // console.log(currTime + "FOUND CURR TIME!!!!!!!!!!!!");

  // lastTime = currTime; 

  // if (currTime - prevTime < 1) {
  //     //have a pop up saying you can only submit one form a minute pls no spam
  //     console.log("LESS THAN ONE MINUTE!!!!!");
  //     res.send("spam");
  // }
  //else {
    var final_lost_matches_list = []
    //add a new lost form
    var new_found_item = {
      "username" : username,
      "item_category" : req.body.item_category,
      "item_subcategory": req.body.item_subcategory,
      "item_location": [req.body.item_lat,req.body.item_lng],
      "lost_matches_list": [],
      "item_description": req.body.item_description,
      "recovered" : false
    };

    foundCollection.insert(new_found_item, function (err, insertResult) {
      if (err) { //error
        console.log(err);
      } 
      else { 
        var found_form_id = new_found_item._id;
        //go through all found forms and find possible matches
        //add id of lost form to all potential found forms 'lost_matches_list'
        //add ids of all found forms to the 'found_matches_list' of the lost item
        lostCollection.find({"item_category":req.body.item_category,"item_subcategory":req.body.item_subcategory }).toArray(function (err, result) {
          if (err) {
            console.log(err);
          } 
          else {
            //res.send(JSON.stringify(result));
            for(var i = 0; i < result.length; i++) {
                //var category = result[i]['item_category']; 
                //var subcategory = "   >   " + lost_arr[i]['item_subcategory']; 
                //var found_location= new google.maps.LatLng(parseFloat(result[i]['item_location'][0]), parseFloat(result[i]['item_location'][1]));
                //var lost_location= new google.maps.LatLng(parseFloat(req.body.item_lat),parseFloat(req.body.item_lng))
                //var distance= google.maps.geometry.spherical.computeDistanceBetween (found_location, lost_location);
                var distance = 0;
                if ((result[i]['item_location'][0] !== "none") && (req.body.item_lat !== "none")){
                    var lost_location = [parseFloat(result[i]['item_location'][0]),parseFloat(result[i]['item_location'][1])];
                    var found_location = [parseFloat(req.body.item_lat),parseFloat(req.body.item_lng)];
                    distance = getDistance(found_location,lost_location);
                }  
                if (distance < 804.67) { //meters of .5 mile
                  //idk syntax
                  var object_fun = {}
                  object_fun[result[i]['_id']] = "gray";
                  final_lost_matches_list.push(object_fun);    
                  //find previous lost_list of found forms
                  //console.log(JSON.stringify(final_found_matches_list) + "!!!!!!");
                  prev_list = result[i]["found_matches_list"];
                  new_dict = {};
                  new_dict[found_form_id] = "red";
                  prev_list.push(new_dict);

                  //EMAIL VERIFICATION: notifying loser that there was a match
                  var mailOptions = {
                      from: 'ihtfyp <ihtfyp@gmail.com>', // sender address 
                      to: result[i]['username'], // list of receivers 
                      subject: 'IHTFYP: Someone found an item that could be yours!', // Subject line 
                      text: '', // plaintext body 
                      html: 'Please check your <a href="https://ihtfyp.herokuapp.com">dashboard</a> to answer a verification question about your lost item. <br></br> Good luck! <br></br>IHTFYP' // html body 
                  };
                   
                  // send mail with defined transport object 
                  transporter.sendMail(mailOptions, function(error, info){
                      if(error){
                          return console.log(error);
                      }
                  });


                  lostCollection.update(
                      { "_id": result[i]["_id"]},
                        {
                         $set: {
                           "found_matches_list": prev_list
                         }
                      }
                  );
                }
            }
            foundCollection.update(
              { "_id": found_form_id},
                {
                 $set: {
                   "lost_matches_list": final_lost_matches_list
                 }
              });
            usersCollection.find({username: username}).toArray(function (err, result) {
              if (err) {
                console.log(err);
              } 
              else {
                var prev_list = result[0]['found_list']
                prev_list.push(found_form_id)
                usersCollection.update(
                  { "username": username },
                  {
                    $set: {
                      "found_list": prev_list
                    }
                });
              }           
            });
          }
        });
      } 
    });
  //}  
});

app.post('/getlost', function(req, res, next) {
  var lostCollection = db.collection('lost'); 
  username = req.session.user["username"];

  lostCollection.find({username: username}).toArray(function (err, result) {
      if (err) {
        console.log(err);
      } 
      else {
        res.send(JSON.stringify(result));
      }
    }); 
});

app.post('/getfound', function(req, res, next) {
  var foundCollection = db.collection('found'); 
  username = req.session.user["username"];

  foundCollection.find({username: username}).toArray(function (err, result) {
      if (err) {
        console.log(err);
      } 
      else {
        res.send(JSON.stringify(result));
      }
    }); 
});

app.post('/answerverification', function(req, res, next) {
  var lost_id = req.body.lost_id;
  var found_id = req.body.found_id;

  var verificationCollection = db.collection('verification'); 

  verificationCollection.find({"lost_id": lost_id, "found_id": found_id}).toArray(function (err, result) {
      if (err) {
        console.log(err);
      } 
      else {
        res.send(JSON.stringify(result));
      }
    }); 
}); 

app.post('/getmatched', function(req, res, next) {
  var matchedCollection = db.collection('matched'); 

  matchedCollection.count(function(err, count) {
    res.send(JSON.stringify(count));
  });
}); 


app.post('/addverification', function(req, res, next) {
  var verificationCollection = db.collection('verification');
  var foundCollection = db.collection('found');
  var lostCollection = db.collection('lost'); 

  var lost_id = req.body.lost_id;
  var found_id = req.body.found_id;
  var verification_text = req.body.verification_text; 

  //Adding the new entry to the db
  verificationCollection.insert({
        "lost_id" : lost_id,
        "found_id" : found_id,
        "verification_text" : verification_text
    }, function (err, insertResult) {

    foundCollection.find({"_id": ObjectId(found_id)}).toArray(function (err, result) {
        if (err) {
          console.log(err);
        } 
        else {
          var prev_lost_matches_list = result[0]['lost_matches_list'];
          for(var i = 0; i < prev_lost_matches_list.length; i++) {
            var keys = Object.keys(prev_lost_matches_list[i]); 
            if(keys[0] === lost_id) {
              prev_lost_matches_list[i][keys[0]] = 'red';  
              break; 
            }
          } 

          foundCollection.update(
            { "_id": ObjectId(found_id)},
              {
               $set: {
                 "lost_matches_list": prev_lost_matches_list
               }
            }
          );

          //EMAIL VERIFICATION: notifying finder about loser's verification 
          var mailOptions = {
              from: 'ihtfyp <ihtfyp@gmail.com>', // sender address 
              to: result[0]['username'], // list of receivers 
              subject: 'IHTFYP: Someone thinks you found their item!', // Subject line 
              text: '', // plaintext body 
              html: 'Please check your <a href="https://ihtfyp.herokuapp.com">dashboard</a> to confirm that what you found is theirs. <br></br> Thank you! <br></br>IHTFYP' // html body 
          };
           
          // send mail with defined transport object 
          transporter.sendMail(mailOptions, function(error, info){
              if(error){
                  return console.log(error);
              }
          });
        }
    });

    lostCollection.find({"_id": ObjectId(lost_id)}).toArray(function (err, result) {
        if (err) {
          console.log(err);
        } 
        else {
          var prev_found_matches_list = result[0]['found_matches_list'];
          for(var i = 0; i < prev_found_matches_list.length; i++) {
            var keys = Object.keys(prev_found_matches_list[i]); 
            if(keys[0] === found_id) {
              prev_found_matches_list[i][keys[0]] = 'gray';  
              break; 
            }
          } 

          lostCollection.update(
            { "_id": ObjectId(lost_id)},
              {
               $set: {
                 "found_matches_list": prev_found_matches_list
               }
            }
          );
        }
    });
  });
});

app.post('/yesverification', function(req, res, next) {
  var foundCollection = db.collection('found');
  var lostCollection = db.collection('lost'); 

  var lost_id = req.body.lost_id;
  var found_id = req.body.found_id;

  foundCollection.find({"_id": ObjectId(found_id)}).toArray(function (err, result) {
        var description = result[0]['item_description']; 
        var finderemail = result[0]['username']; 

        if (err) {
          console.log(err);
        } 
        else {
          var prev_lost_matches_list = result[0]['lost_matches_list'];
          console.log("PREV LIST IS " + JSON.stringify(prev_lost_matches_list));
          for(var i = 0; i < prev_lost_matches_list.length; i++) {
            var keys = Object.keys(prev_lost_matches_list[i]); 
            if(keys[0] === lost_id) {
              prev_lost_matches_list[i][keys[0]] = 'blue';  
              break; 
            }
          } 

          foundCollection.update(
            { "_id": ObjectId(found_id)},
              {
               $set: {
                 "lost_matches_list": prev_lost_matches_list
               }
            }
          );
        }

    lostCollection.find({"_id": ObjectId(lost_id)}).toArray(function (err, result) {
        if (err) {
          console.log(err);
        } 
        else {
          console.log("UPDATING THE LOST ITEM ........" + JSON.stringify(result));
          var prev_found_matches_list = result[0]['found_matches_list'];
          console.log("PREV LIST IS " + JSON.stringify(prev_found_matches_list));
          for(var i = 0; i < prev_found_matches_list.length; i++) {
            var keys = Object.keys(prev_found_matches_list[i]); 
            if(keys[0] === found_id) {
              prev_found_matches_list[i][keys[0]] = 'blue';  
              break; 
            }
          } 

          lostCollection.update(
            { "_id": ObjectId(lost_id)},
              {
               $set: {
                 "found_matches_list": prev_found_matches_list
               }
            }
          );

          
          var emailtext = "";
          if(description === "") {
            emailtext = "Someone confirmed your verification answer. Their email is " + finderemail + ". Please contact them to make sure this is your item-- ask for a picture if there is any ambiguity. Then, arrange a pickup, and delete this item from your dashboard to stop receiving email notifications. <br></br> Thank you! <br></br>IHTFYP";
          }
          else {
            emailtext = "Someone confirmed your verification answer. Here is their description of the object they found: " + description + "<br></br> Their email is " + finderemail + ". Please contact them to make sure this is your item-- ask for a picture if there is any ambiguity. Then, arrange a pickup, and delete this item from your dashboard to stop receiving email notifications. <br></br> Thank you! <br></br>IHTFYP"; 
          }


          //EMAIL VERIFICATION: notifying loser that the finder confirmed their verification
          var mailOptions = {
              from: 'ihtfyp <ihtfyp@gmail.com>', // sender address 
              to: result[0]['username'], // list of receivers 
              subject: 'IHTFYP: Someone may have found your item! :)', // Subject line 
              text: '', // plaintext body 
              html: emailtext // html body 
          };
           
          // send mail with defined transport object 
          transporter.sendMail(mailOptions, function(error, info){
              if(error){
                  return console.log(error);
              }
          });
        }
    });

    });
});

app.post('/noverification', function(req, res, next) {
  var foundCollection = db.collection('found');
  var lostCollection = db.collection('lost'); 

  var lost_id = req.body.lost_id;
  var found_id = req.body.found_id;

  foundCollection.find({"_id": ObjectId(found_id)}).toArray(function (err, result) {
        if (err) {
          console.log(err);
        } 
        else {
          var prev_lost_matches_list = result[0]['lost_matches_list'];
          for(var i = 0; i < prev_lost_matches_list.length; i++) {
            var keys = Object.keys(prev_lost_matches_list[i]); 
            if(keys[0] === lost_id) {
              prev_lost_matches_list.splice(i, 1);
              break; 
            }
          } 

          foundCollection.update(
            { "_id": ObjectId(found_id)},
              {
               $set: {
                 "lost_matches_list": prev_lost_matches_list
               }
            }
          );
        }
    });

    lostCollection.find({"_id": ObjectId(lost_id)}).toArray(function (err, result) {
        if (err) {
          console.log(err);
        } 
        else {
          var prev_found_matches_list = result[0]['found_matches_list'];
          for(var i = 0; i < prev_found_matches_list.length; i++) {
            var keys = Object.keys(prev_found_matches_list[i]); 
            if(keys[0] === found_id) {
              prev_found_matches_list.splice(i, 1); 
              break; 
            }
          } 

          lostCollection.update(
            { "_id": ObjectId(lost_id)},
              {
               $set: {
                 "found_matches_list": prev_found_matches_list
               }
            }
          );
        }
    });
});


app.post('/deletefound', function(req, res, next) {
  var foundCollection = db.collection('found');
  var lostCollection = db.collection('lost'); 
  var usersCollection = db.collection('users');

  var found_id = req.body.found_id;

  foundCollection.find({"_id": ObjectId(found_id)}).toArray(function (err, result) {
    if (err) {
      console.log(err);
    } 
    else {
      var prev_lost_matches_list = result[0]['lost_matches_list'];
      for(var i = 0; i < prev_lost_matches_list.length; i++) {

        (function(value) {
        var lostkeys = Object.keys(prev_lost_matches_list[value]); 


        lostCollection.find({"_id": ObjectId(lostkeys[0])}).toArray(function (err, result) {
            if (err) {
              console.log(err);
            } 
            else {

              var prev_found_matches_list = result[0]['found_matches_list'];
              for(var j = 0; j < prev_found_matches_list.length; j++) {
                var foundkeys = Object.keys(prev_found_matches_list[j]); 
                if(foundkeys[0] === found_id) {
                  prev_found_matches_list.splice(j, 1); 

              lostCollection.update(
                { "_id": ObjectId(lostkeys[0])},
                  {
                   $set: {
                     "found_matches_list": prev_found_matches_list
                   }
                }
              ); 
                }
              }
            }
        });
        })(i);
      }; 
    } 
  });

  username = req.session.user["username"]; 
  usersCollection.find({username: username}).toArray(function(err, result) {
    if(err) {
      console.log(err);
    }
    else {
      var prev_found_list = result[0]['found_list']; 
      for(var k = 0; k < prev_found_list.length; k++) {
        if(found_id === prev_found_list[k]['_id']) {
          prev_found_list.splice(k, 1); 
          break; 
        }
      }

      usersCollection.update(
        { "username": username},
          {
           $set: {
             "found_list": prev_found_list
           }
        }
      );
    }
  }); 

  foundCollection.remove({"_id": ObjectId(found_id)}); 
});

app.post('/deletelostnomatch', function(req, res, next) {
  var foundCollection = db.collection('found');
  var lostCollection = db.collection('lost'); 
  var usersCollection = db.collection('users');

  var lost_id = req.body.lost_id;


  lostCollection.find({"_id": ObjectId(lost_id)}).toArray(function (err, result) {
    if (err) {
      console.log(err);
    } 
    else {
      var prev_found_matches_list = result[0]['found_matches_list'];
      for(var i = 0; i < prev_found_matches_list.length; i++) {

        (function(value) {
        var foundkeys = Object.keys(prev_found_matches_list[value]); 

        foundCollection.find({"_id": ObjectId(foundkeys[0])}).toArray(function (err, result) {
            if (err) {
              console.log(err);
            } 
            else {
              var prev_lost_matches_list = result[0]['lost_matches_list'];
              for(var j = 0; j < prev_lost_matches_list.length; j++) {
                var lostkeys = Object.keys(prev_lost_matches_list[j]); 
                if(lostkeys[0] === lost_id) {
                  prev_lost_matches_list.splice(j, 1); 

                  foundCollection.update(
                    { "_id": ObjectId(foundkeys[0])},
                      {
                       $set: {
                         "lost_matches_list": prev_lost_matches_list
                       }
                    }
                  ); 
                }
              }
            }
        });
        })(i);
      }; 
    } 
  });

  username = req.session.user["username"]; 
  usersCollection.find({username: username}).toArray(function(err, result) {
    if(err) {
      console.log(err);
    }
    else {
      var prev_lost_list = result[0]['lost_list']; 
      for(var k = 0; k < prev_lost_list.length; k++) {
        if(lost_id === prev_lost_list[k]['_id']) {
          prev_lost_list.splice(k, 1); 
          break; 
        }
      }

      usersCollection.update(
        { "username": username},
          {
           $set: {
             "lost_list": prev_lost_list
           }
        }
      );
    }
  }); 

  lostCollection.remove({"_id": ObjectId(lost_id)}); 
});

//delete lost and found item
app.post('/deletelostyesmatch', function(req, res, next) {
  var foundCollection = db.collection('found');
  var lostCollection = db.collection('lost'); 
  var usersCollection = db.collection('users');
  var matchedCollection = db.collection('matched'); 

  var lost_id = req.body.lost_id;
  var found_id;
  var founder_username;  
  var item_category;
  var item_subcategory; 

  lostCollection.find({"_id": ObjectId(lost_id)}).toArray(function (err, result) {
    if (err) {
      console.log(err);
    } 
    else {
      item_category = result[0]['item_category'];
      item_subcategory = result[0]['item_subcategory']; 

      //DELETE ITEM FROM FINDER 
      var prev_found_matches_list = result[0]['found_matches_list'];
      for(var i = 0; i < prev_found_matches_list.length; i++) {

        (function(value) {
        var foundkeys = Object.keys(prev_found_matches_list[value]); 
      
        foundCollection.find({"_id": ObjectId(foundkeys[0])}).toArray(function (err, result) {
            if (err) {
              console.log(err);
            } 
            else {
              var prev_lost_matches_list = result[0]['lost_matches_list'];
              
              for(var j = 0; j < prev_lost_matches_list.length; j++) {
                var lostkeys = Object.keys(prev_lost_matches_list[j]); 
                if(lostkeys[0] === lost_id) {
                  if(prev_lost_matches_list[j][lostkeys[0]] === 'blue') {
                    founder_username = result[0]['username']; 
                    found_id = foundkeys[0];      
                  }
                  prev_lost_matches_list.splice(j, 1);
                  foundCollection.update(
                    { "_id": ObjectId(foundkeys[0])},
                      {
                       $set: {
                         "lost_matches_list": prev_lost_matches_list
                       }
                    }
                  ); 
                }
              }
            }
        });
        })(i);
      }; 

      matchedCollection.insert({
            "item_category" : item_category,
            "item_subcategory" : item_subcategory
        }, function (err, insertResult) {
          // Send back a success message
      });   
    } 
  });

  username = req.session.user["username"]; 
  usersCollection.find({username: username}).toArray(function(err, result) {
    if(err) {
      console.log(err);
    }
    else {
      var prev_lost_list = result[0]['lost_list']; 
      for(var k = 0; k < prev_lost_list.length; k++) {
        if(lost_id === prev_lost_list[k]['_id']) {
          prev_lost_list.splice(k, 1); 
          break; 
        }
      }

      usersCollection.update(
        { "username": username},
          {
           $set: {
             "lost_list": prev_lost_list
           }
        }
      );
    }
  }); 

  lostCollection.remove({"_id": ObjectId(lost_id)}); 
});
