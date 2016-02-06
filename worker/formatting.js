/** Adapted from https://github.com/ensime/ensime-atom/blob/master/lib/formatting.coffee */

define(function(require, exports, module) {
  var formatCompletionsSignature, formatImplicitInfo, formatParam, formatParamSection, formatParamSections, formatType, functionMatcher, scalaPackageMatcher,
    slice = [].slice;

  formatCompletionsSignature = function(name, callable, typeSig) {
    if (callable) {
      if (typeSig.sections && typeSig.sections.length > 0) {
        var params = formatParamLists(typeSig.sections);
        return name + params + " ⇒ " + typeSig.result;
      }
      else {
        return name + ": " + typeSig.result;
      }
    }
    else {
      return typeSig.result;
    }

    function formatParamLists(paramLists) {
      function formatParamList(paramList) {
        var results = [];
        for (var j = 0, len = paramList.length; j < len; j++) {
          var param = paramList[j];
          var formatted = param[0] + ": " + param[1];
          results.push(formatted);
        }
        return "(" + results.join(", ") + ")";
      }

      var results = [];
      for (var j = 0, len = paramLists.length; j < len; j++) {
        var paramList = paramLists[j];
        results.push(formatParamList(paramList));
      }
      return results.join("");
    }
  };

  formatParam = function(param) {
    var result;
    result = formatType(param[1]);
    return param[0] + ": " + result;
  };

  formatParamSection = function(paramSection) {
    var p, param;
    p = (function() {
      var j, len, ref, results;
      ref = paramSection.params;
      results = [];
      for (j = 0, len = ref.length; j < len; j++) {
        param = ref[j];
        results.push(formatParam(param));
      }
      return results;
    })();
    if (paramSection.isImplicit) return "implicit " + p.join(", ");
    else return p.join(", ");
  };

  formatParamSections = function(paramSections) {
    var paramSection, sections;
    sections = (function() {
      var j, len, results;
      results = [];
      for (j = 0, len = paramSections.length; j < len; j++) {
        paramSection = paramSections[j];
        results.push(formatParamSection(paramSection));
      }
      return results;
    })();
    return "(" + sections.join(")(") + ")";
  };

  functionMatcher = /scala\.Function\d{1,2}/;

  scalaPackageMatcher = /scala\.([\s\S]*)/;

  formatType = function(theType) {
    var formattedTypeArgs, i, j, name, o, params, result, scalaPackage, typeArg, typeArgs;
    if (theType.typehint === "ArrowTypeInfo") {
      return formatParamSections(theType.paramSections) + " ⇒ " + formatType(theType.resultType);
    }
    else if (theType.typehint === "BasicTypeInfo") {
      typeArgs = theType.typeArgs;
      scalaPackage = scalaPackageMatcher.exec(theType.fullName);
      if (scalaPackage) name = scalaPackage[1];
      else {
        switch (theType.declAs.typehint) {
          case 'Class':
          case 'Trait':
          case 'Object':
          case 'Interface':
            name = theType.fullName.replace(/\$\$/, ".").replace(/\$/, "").replace(/^<empty>./, "");
            break;
          default:
            name = theType.name;
        }
      }
      if (!typeArgs || typeArgs.length === 0) {
        return name;
      }
      else {
        formattedTypeArgs = (function() {
          var j, len, results;
          results = [];
          for (j = 0, len = typeArgs.length; j < len; j++) {
            typeArg = typeArgs[j];
            results.push(formatType(typeArg));
          }
          return results;
        })();
        if (theType.fullName === 'scala.<byname>') {
          return "⇒ " + formattedTypeArgs.join(", ");
        }
        else if (theType.fullName === "scala.Function1") {
          i = formattedTypeArgs[0], o = formattedTypeArgs[1];
          return i + " ⇒ " + o;
        }
        else if (functionMatcher.test(theType.fullName)) {
          params = 2 <= formattedTypeArgs.length ? slice.call(formattedTypeArgs, 0, j = formattedTypeArgs.length - 1) : (j = 0, []), result = formattedTypeArgs[j++];
          return "(" + (params.join(", ")) + ") ⇒ " + result;
        }
        else {
          return name + ("[" + (formattedTypeArgs.join(", ")) + "]");
        }
      }
    }
  };

  formatImplicitInfo = function(info) {
    if (info.typehint === 'ImplicitParamInfo') {
      return "Implicit parameters added to call of " + info.fun.localName + ": (" + (info.params.map(function(p) {
        return p.localName;
      }).join(", ")) + ")";
    }
    else if (info.typehint === 'ImplicitConversionInfo') {
      return "Implicit conversion: " + info.fun.localName;
    }
  };

  module.exports = {
    formatCompletionsSignature: formatCompletionsSignature,
    formatType: formatType,
    formatImplicitInfo: formatImplicitInfo
  };
});