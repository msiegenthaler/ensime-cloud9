var http = require("http");
var url = require("url");

if (process.argv.length < 3) {
  return console.error("Specify the documentation to fetch as the first argument.");
}
var docUrl = process.argv[2];
if (process.argv.length < 4) {
  return console.error("Specify the ENSIME port as the second argument.");
}
var ensimePort = parseInt(process.argv[3], 10);

process.stdout.encoding = "utf-8";

var fullUrl;
if (docUrl.indexOf("http") == 0)
  fullUrl = docUrl;
else if (docUrl.indexOf("doc") == 0)
  fullUrl = `http://localhost:${ensimePort}/${docUrl}`;
else {
  console.error("Invalid URL: " + docUrl);
  process.exit(1);
}

var req = url.parse(fullUrl);
http.get(req, (res) => {
  if (res.statusCode != 200) {
    console.error("Got status code " + res.statusCode);
    return process.exit(1);
  }
  res.pipe(process.stdout);
});
