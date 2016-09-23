
var roboto = require('roboto');
var elasticsearch = require('elasticsearch');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var router = express.Router();

app.use('/client', express.static('client'));

var html_strip = require('htmlstrip-native').html_strip;
var stripOptions = {
  include_script : false,
  include_style : false,
  compact_whitespace : true
};

var client = new elasticsearch.Client({
  host: 'localhost:9200'
  //log: 'trace'
});


var crawler = new roboto.Crawler({
  startUrls: [
    "http://www.usa-cigarettes.com/",
  ],
  allowedDomains: [
    "usa-cigarettes.com",
  ]
});

var myPipeline = function(item, done) {
  console.log("Here is JSON");
  console.log(JSON.stringify(item, null, '  '));
  client.index({
    index: 'usa-cigarettes',
    type: 'search',
    body: {
      url: item.url,
      title: item.title,
      body: item.body
    }
  }, function (error, response) {
      done();
  });
};

router.get('/crawl',function(req,res) {
  crawler.crawl();
  res.send("Started crawling usa-cigarettes.com");
});

router.get('/search',function(req,res) {
  console.log(req.query.query);
  client.search({
    index: 'usa-cigarettes',
    type: 'search',
    body: {
      query: {
        match: {
          body: req.query.query
        }
      }
    }
  }).then(function (resp) {
    var hits = resp.hits.hits;
    console.log(hits);
    if(hits.length === 0) {
      return res.json({error: 1, message: "No result found for this keyword", data: []});
    }
    var response = [];
    hits.map(function(singleObject) {
      response.push(singleObject._source);
    });
    console.log(response);
    res.json({error: 0,message: "success",data: response});
    //console.log(resp);
  }, function (err) {
    console.trace(err.message);
  });
});

app.use('/',router);

crawler.parseField('url', function(response) {
  return response.url;
});

crawler.parseField('title', function(response, $) {
  return $('head title').text();
});

crawler.parseField('body', function(response, $) {
  var html = $('body').html();
  if (html) {
    return html_strip(html, stripOptions);
  }
});

crawler.on('item', function(item) {
  // Do something with the item!
});

crawler.on('finish',function() {
  // done crawling
  io.emit('finish');
});

crawler.pipeline(myPipeline);


http.listen(8080,function(){
    console.log("Listening on 8080");
});
