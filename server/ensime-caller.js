var http = require("http");
var fs = require("fs");

if (process.argv.length < 3) {
  console.error("Missing argument 1: ENSIME port.");
  return process.exit(3);
}
if (process.argv.length < 4) {
  console.error("Missing argument 2: JSON.");
  return process.exit(3);
}
var port = process.argv[2];
var inData = process.argv[3];
var data = JSON.parse(inData);

if (data.fileInfo && data.fileInfo.currentContents) {
  delete data.fileInfo.currentContents;

  // if (process.argv.length < 5) {
  // return process.exit(4);
  // }
  // var c = fs.readFileSync(process.argv[4], "utf-8");
  // data.fileInfo.contents = c;

  var chunks = [];
  process.stdin.on('data', function(chunk) {
    chunks.push(chunk);
  });
  process.stdin.on('end', function() {
    var body = Buffer.concat(chunks);
    data.fileInfo.contents = body.toString("ascii");
    fs.writeFileSync("/tmp/bla", JSON.stringify(data), "utf-8");
    callEnsime(data);
  });
}
else
  callEnsime(data);

function callEnsime(data) {
  var postData = JSON.stringify(data);

  var req = http.request({
    hostname: "localhost",
    port: port,
    path: "/rpc",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": postData.length
    }
  }, function(response) {
    response.setEncoding("utf-8");
    if (response.statusCode == 200) {
      response.on("data", function(chunk) {
        process.stdout.write(chunk);
      });
      response.on("end", function() {
        process.exit(0);
      });
    }
    else {
      console.error(`Request failed with status code ${response.statusCode}`);
      response.on("data", function(chunk) {
        console.error(chunk);
      });
      response.on("end", function() {
        process.exit(1);
      });
    }
  });
  req.on("error", function(err) {
    console.error("Call to ensime failed");
    console.error(err);
    process.exit(2);
  });
  req.write(postData, "utf-8");
  req.end();
}