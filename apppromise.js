var express = require('express');
var bodyParser = require('body-parser');
var session = require('client-sessions');
var redis = require('redis');
var Q = require('q');
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
var searchUserDatabase = function(index, amountUsers, req, res) {
	return new Q.Promise(function (resolve, reject) {
	
	var login = req.body.email;
	var password = req.body.password;
	var id = index;
	var amount = amountUsers;
	var success = false;
	//get the user:id information to compare them to the values passed by the user
		Q.ninvoke(client, 'hgetall', 'User:'+id)
		.then(function(obj){
			if((obj.email===login)&&(obj.password===password)){
				//User has been found. Return the promise to be used on 'then'
				success = true;			
				resolve(obj);
			}else{	
				//if there are other users to look at, check them.	
				if(id < amount-1){
					//search the next user registered.
					resolve(searchUserDatabase(id+1, amount, req, res));
				}else{
					//User hasn't been found. Return the promise to be used on 'catch'
					if(success ==false)
						reject("User not found");
				}
			}
		})   
	});
}

var searchUserDatabaseByEmail = function(index, amountUsers, email) {
	return new Q.Promise(function (resolve, reject) {
	
	var id = index;
	var amount = amountUsers;
	var success = false;
	//get the user:id information to compare them to the values passed by the user
		Q.ninvoke(client, 'hgetall', 'User:'+id)
		.then(function(obj){
			if(obj.email===email){
				//User has been found. Return the promise to be used on 'then'
				success = true;			
				resolve(obj);
			}else{	
				//if there are other users to look at, check them.	
				if(id < amount-1){
					//search the next user registered.
					resolve(searchUserDatabaseByEmail(id+1, amount, email));
				}else{
					//User hasn't been found. Return the promise to be used on 'catch'
					if(success ==false)
						reject("User not found");
				}
			}
		})   
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
		Q.ninvoke(client, 'get', 'id')
		.catch(function(err){
			console.log('error getting id')
		})
		.then(function(reply){
			searchUserDatabaseByEmail(0, reply, req.session.user.email)
			.then(function (obj) {
				res.locals.user = obj;
				res.render('dashboard.jade');
			})
			.catch(function(){
				req.session.reset();
				res.redirect('/login');
			})
					
		})
		
	}
	
});

//POST
app.post('/register', function(req, res){
	console.log(req.params);
	console.log(req.body.email.toString());
	
	//get the id, which is the amount of users registered. 
	//This value is being used as an id of the new user.
	Q.ninvoke(client, 'get', 'id')
		.catch(function (error){
			console.log('err getting id client.get');
		})
		.then(function (reply){
			var id = reply;
    		//Saves the new User:id in the database
    		Q.ninvoke(client, 'hmset', 'User:'+id,  { 
    		  'firstName': req.body.firstName.toString(), 
			  'lastName': req.body.lastName.toString(),
			  'email': req.body.email.toString(),
			  'password': req.body.password.toString()
			})
		})
    	.then(function(){
   			Q.ninvoke(client, 'incr', 'id')
  			})
  		.then(function(reply) {
			res.redirect('/');	
    	})
    	.catch(function(err){
			res.redirect('/register');
    	})		
});

app.post('/login', function(req, res){
	var login = req.body.email.toString();
	console.log('Login sent:' + login);
	var pass = req.body.password.toString();
	console.log('Password sent:' + pass);
	
	//get the id, which is the amount of users registered.
	Q.ninvoke(client, 'get', 'id')
	.then(function(reply){
		searchUserDatabase(0, reply, req, res)
		.then(function(user){
			console.log('Saiu da funcao')
			req.session.user = user;
			res.redirect('/dashboard');
		})
		.catch(function(){
			res.redirect('/');
		})
	})
		
});
app.listen(8000);