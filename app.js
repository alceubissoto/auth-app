var express = require('express');
var bodyParser = require('body-parser');
var session = require('client-sessions');
var redis = require('redis');
var app = express();
var client = redis.createClient()
var id = 0;
client.on('connect', function() {
    console.log('connected');
});

app.set('view engine', 'jade');

app.use(session({
	cookieName: 'session',
	secret: 'poas89d2qw43poeip9gvjmxcvk124lsjtuiwe3r2h',
	duration: 1*5*1000, //ms
}));
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}));
//Flush the database
client.flushdb();
//If the database wasnt being flushed, id should be set to the number of users already registered.
//Setting id in the database to inform there are no users registered.
client.set('id', 0, function(err, reply){
				if(err!== null)
					console.log("errorID: "+ err)
			});
// ROUTES

/*Input: 
	index: index of the user being checked in the database
	amountUsers: number of users registered in the database
	req: request, used to get the information passed by the user
	res: response, used to redirect the user to another page.
	callback: works with the result of the search.
This function will compare the values stored in the database regarding Users
with the values passed by the User via Post request.
*/
function searchUserDatabase(index, amountUsers, req, res, callback) {
	var login = req.body.email;
	var password = req.body.password;
	var id = index;
	var amount = amountUsers;
	var success = false;
	//get the user:id information to compare them to the values passed by the user
	client.hgetall('User:'+id, function (err, obj){
		if(err !== null){
			console.log("errorgetall: " + err);
			
		}
		else {
			//compare them. If success, return object, else, try again with a new index.
			if((obj.email===login)&&(obj.password==password)){	
				//return the obj which contains the user information.
				//console.log('object: '+ obj.toString());
				success = true;
				console.log('obj after success: '+obj);
				callback(obj);
				console.log('Aftercallback');
			}else{		
				if(id < amount-1){
					searchUserDatabase(id+1, amount, req, res, callback);
				}else{
					if(success ==false)
						callback(null);
				}
			}
		}
		console.log('success?: '+ success);

	});
}

function searchUserDatabaseByEmail(index, amountUsers, email, callback){
	var id = index;
	var amount = amountUsers;
	var success = false;
	//get the user:id information to compare them to the values passed by the user
	client.hgetall('User:'+id, function (err, obj){
		if(err !== null){
			console.log("errorgetall: " + err);
			
		}
		else {
			//compare them. If success, redirect to dashboard
			//else, redirect to index.
			if(obj.email===email){
				//req.session.user = obj;		
				//return the obj which contains the user information via callback.
				//console.log('object: '+ obj.toString());
				success = true;
				callback(obj);
			}else{		
				if(id < amount-1){
					searchUserDatabaseByEmail(id+1, amount, email, callback);
				}else{
					if(success == false)
						callback(null);
				}
			}
		}
		console.log('successEmail?: '+ success);
		
			
	});
}

//GET
app.get('/', function(req, res){
	res.render('index.jade');	
});
app.get('/register', function(req, res){
	res.render('register.jade');	
});
app.get('/login', function(req, res){
	res.render('login.jade');	
});
app.get('/dashboard', function(req, res){
	if(req.session && req.session.user){
		//We are going to do another search, to get the information of the user
		//informed via session (email).
		client.get('id', function(err, reply) {
			
			if(err!== null)
				console.log("error getting id");
			else{
				searchUserDatabaseByEmail(0, reply, req.session.user.email, function (obj) {
					if(obj !== null){
						res.locals.user = obj;
						res.render('dashboard.jade');
					}else{
						req.session.reset();
						res.redirect('/login');
					}

				});
			}
			
		});
		
	}
	else{
		req.session.reset();
		res.redirect('/');
		}
});

//POST
app.post('/register', function(req, res){
	console.log(req.params);
	console.log(req.body.email.toString());
	
			//get the id, which is the amount of users registered. 
			//This value is being used as an id of the new user.
			client.get('id', function(err, reply) {
    			if(err==! null)
    				console.log('err getting id client.get');
    			else{
    				var id = reply;
    				//Saves the new User:id in the database
    				client.hmset('User:'+id, 
					{ 'firstName': req.body.firstName.toString(), 
					  'lastName': req.body.lastName.toString(),
					  'email': req.body.email.toString(),
					  'password': req.body.password.toString()
					}, function (err, obj) {
						//increases id (amount of Users)
						//if there's an error, redirect to register
						//else, redirect to index.
						id = client.incr('id', function (err, reply){
							if(err !== null){
								console.log("errorincr: " + err);
								res.redirect('/register');
							}
							else{
								console.log('newId: '+ reply);
								res.redirect('/');
							}
						});
					});
    			}
    		});
});

app.post('/login', function(req, res){
	var login = req.body.email.toString();
	console.log('Login sent:' + login);
	var pass = req.body.password.toString();
	console.log('Password sent:' + pass);
	
	//get the id, which is the amount of users registered.
	client.get('id', function(err, reply) {
		var user= '';
		if(err!== null)
			console.log("error getting id");
		else{
			//reply is the amount of users.
			//search the database using this value.
			searchUserDatabase(0, reply, req, res, function (user) {
				console.log('obj in the callback login:' + user)
				if(user !== null)
				{
					//console.log('obj in the login after found: '+obj.email)
					req.session.user = user;
					res.redirect('/dashboard');
				}else{
					res.redirect('/');
				}
			});
			
    	}
	});	
	
});
app.listen(8000);