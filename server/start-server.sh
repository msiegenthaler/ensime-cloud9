#!/bin/bash

# Start the ensime server.
#  based on https://gist.github.com/fommil/4ff3ad5b134280de5e46

ENSIME_VERSION="0.9.10-SNAPSHOT"

echo "Starting ensime-server $ENSIME_VERSION with '$1'..."

if [ -x $1 ] ; then
    echo "No .ensime provided"
    exit 1
fi

ENSIME_CONFIG=$1
ENSIME_CONFIG="${ENSIME_CONFIG/#\~/$HOME}"

if [ ! -f "$ENSIME_CONFIG" ] ; then
    echo "ensime config $ENSIME_CONFIG not found"
    exit 1
fi
echo "Reading ENSIME ${ENSIME_VERSION} config from $ENSIME_CONFIG"

# rock solid implementation of Greenspun's tenth rule
# @param the property to extract (assumed to be unique)
# @returns the value for the property
function sexp_prop {
 cat "$ENSIME_CONFIG" | tr -d '\n' | tr '(' ' ' | tr ')' ' ' | sed -e 's/ :/\n/g' | tr -d '"' | grep $1 | sed -e 's/^[^ ]* *//' -e 's/ *$//'
}

export JAVA_HOME=`sexp_prop java-home`
export JDK_HOME="$JAVA_HOME"
JAVA="$JAVA_HOME/bin/java"
if [ ! -x "$JAVA" ] ; then
    echo ":java-home is not correct, $JAVA is not the java binary."
    exit 1
fi
echo "  -> Using JDK at $JAVA_HOME"

JAVA_FLAGS=`sexp_prop java-flags`
echo "  -> Using flags $JAVA_FLAGS"

export ENSIME_CACHE=`sexp_prop cache-dir`
mkdir -p "$ENSIME_CACHE" > /dev/null
if [ ! -d "$ENSIME_CACHE" ] ; then
    echo ":cache-dir is not correct, $ENSIME_CACHE is not a directory."
    exit 1
fi
echo "  -> Using cache at $ENSIME_CACHE"

export SCALA_VERSION=`sexp_prop scala-version`
echo "  -> Using scala version $SCALA_VERSION"

RESOLUTION_DIR=`mktemp -d`
CLASSPATH_FILE="$RESOLUTION_DIR/classpath"
mkdir -p "$RESOLUTION_DIR"/project


echo "  -> Resolving.."
# This bit is slow, and can definitely be cached to produce CLASSPATH

cat <<EOF > "$RESOLUTION_DIR/build.sbt"
import sbt._
import IO._
import java.io._
scalaVersion := "${SCALA_VERSION}"
ivyScala := ivyScala.value map { _.copy(overrideScalaVersion = true) }
// allows local builds of scala
resolvers += Resolver.mavenLocal
resolvers += Resolver.sonatypeRepo("snapshots")
resolvers += "Typesafe repository" at "http://repo.typesafe.com/typesafe/releases/"
resolvers += "Akka Repo" at "http://repo.akka.io/repository"
libraryDependencies ++= Seq(
  "org.ensime" %% "ensime" % "${ENSIME_VERSION}",
  "org.scala-lang" % "scala-compiler" % scalaVersion.value force(),
  "org.scala-lang" % "scala-reflect" % scalaVersion.value force(),
  "org.scala-lang" % "scalap" % scalaVersion.value force()
)
val saveClasspathTask = TaskKey[Unit]("saveClasspath", "Save the classpath to a file")
saveClasspathTask := {
  val managed = (managedClasspath in Runtime).value.map(_.data.getAbsolutePath)
  val unmanaged = (unmanagedClasspath in Runtime).value.map(_.data.getAbsolutePath)
  val out = file("${CLASSPATH_FILE}")
  write(out, (unmanaged ++ managed).mkString(File.pathSeparator))
}
EOF

cat <<EOF > "$RESOLUTION_DIR/project/build.properties"
sbt.version=0.13.9
EOF

cd "$RESOLUTION_DIR"
sbt saveClasspath

CLASSPATH="$JDK_HOME/lib/tools.jar:`cat $CLASSPATH_FILE`"

echo "  -> Starting ENSIME"
cd "$ENSIME_CACHE"

exec "$JAVA" -classpath "$CLASSPATH" $JAVA_FLAGS -Densime.config="$ENSIME_CONFIG" org.ensime.server.Server