var fs = require("fs");

if (process.argv.length < 3) {
  return console.error("Specify the declPos to get documentation for as the first argument.");
}

function noDocumentation() {
  return process.exit(0);
}

var declPos = JSON.parse(process.argv[2]);

if (declPos.typehint === "EmptySourcePosition")
  return noDocumentation();

var contents = fs.readFileSync(declPos.file, "utf-8");

var offset;
if (declPos.typehint === "LineSourcePosition") {
  offset = -1;
  for (var i = 1; i < declPos.line; i++) {
    offset = contents.indexOf('\n', offset + 1);
  }
}
else if (declPos.typehint === "OffsetSourcePosition") {
  offset = declPos.offset;
}
else {
  console.error("Unknown declPos type: " + declPos.typehint);
  return process.exit(1);
}

//find immediatly preceeding javadoc/scaladoc */
var preceeding = contents.substring(0, offset);
var regex = /(\/\*\*(?:[\s\S](?!\/\*))*\*\/)(?:[\s]*).*$/; //match javadoc on the same or on the previous non-empty line
var matches = regex.exec(preceeding);
if (!matches || !matches.length) return noDocumentation();
var doc = matches[1];

// remove the * /* and /*
doc = doc.replace(/\s*\/?\*+\/?/g, "");

process.stdout.write(doc, "utf-8");