/* Copyright (c) 2013-present The TagSpaces Authors.
 * Use of this source code is governed by the MIT license which can be found in the LICENSE.txt file. */

/* globals marked, Readability, Mousetrap */
"use strict";

sendMessageToHost({command: 'loadDefaultTextContent'});

var $rtfContent;
var isWeb = (document.URL.startsWith('http') && !document.URL.startsWith('http://localhost:1212/'));

$(document).ready(function() {
  function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)");
    var results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
  }

  var locale = getParameterByName("locale");
  var filePath = getParameterByName("file");
  var searchQuery = getParameterByName("query");
  var extSettings;

  loadExtSettings();

  // Init internationalization
  i18next.init({
    ns: {namespaces: ['ns.viewerRTF']},
    debug: true,
    lng: locale,
    fallbackLng: 'en_US'
  }, function() {
    jqueryI18next.init(i18next, $);
    $('[data-i18n]').localize();
  });

  $rtfContent = $("#rtfContent");

  var styles = ['', 'solarized-dark', 'github', 'metro-vibes', 'clearness', 'clearness-dark'];
  var currentStyleIndex = 0;
  if (extSettings && extSettings.styleIndex) {
    currentStyleIndex = extSettings.styleIndex;
  }

  var zoomSteps = ['zoomSmallest', 'zoomSmaller', 'zoomSmall', 'zoomDefault', 'zoomLarge', 'zoomLarger', 'zoomLargest'];
  var currentZoomState = 3;
  if (extSettings && extSettings.zoomState) {
    currentZoomState = extSettings.zoomState;
  }

  $rtfContent.removeClass();
  $rtfContent.addClass('markdown ' + styles[currentStyleIndex] + " " + zoomSteps[currentZoomState]);

  $("#changeStyleButton").on('click', function() {
    currentStyleIndex = currentStyleIndex + 1;
    if (currentStyleIndex >= styles.length) {
      currentStyleIndex = 0;
    }
    $rtfContent.removeClass();
    $rtfContent.addClass('markdown ' + styles[currentStyleIndex] + " " + zoomSteps[currentZoomState]);
    saveExtSettings();
  });

  $("#resetStyleButton").on('click', function() {
    currentStyleIndex = 0;
    $rtfContent.removeClass();
    $rtfContent.addClass('markdown ' + styles[currentStyleIndex] + " " + zoomSteps[currentZoomState]);
    saveExtSettings();
  });

  $("#zoomInButton").on('click', function() {
    currentZoomState++;
    if (currentZoomState >= zoomSteps.length) {
      currentZoomState = 6;
    }
    $rtfContent.removeClass();
    $rtfContent.addClass('markdown ' + styles[currentStyleIndex] + " " + zoomSteps[currentZoomState]);
    saveExtSettings();
  });

  $("#zoomOutButton").on('click', function() {
    currentZoomState--;
    if (currentZoomState < 0) {
      currentZoomState = 0;
    }
    $rtfContent.removeClass();
    $rtfContent.addClass('markdown ' + styles[currentStyleIndex] + " " + zoomSteps[currentZoomState]);
    saveExtSettings();
  });

  $("#zoomResetButton").on('click', function() {
    currentZoomState = 3;
    $rtfContent.removeClass();
    $rtfContent.addClass('markdown ' + styles[currentStyleIndex] + " " + zoomSteps[currentZoomState]);
    saveExtSettings();
  });

  function saveExtSettings() {
    var settings = {
      "styleIndex": currentStyleIndex,
      "zoomState": currentZoomState
    };
    localStorage.setItem('viewerHTMLSettings', JSON.stringify(settings));
  }

  function loadExtSettings() {
    extSettings = JSON.parse(localStorage.getItem("viewerHTMLSettings"));
  }

  // Menu: hide readability items
  $("#readabilityFont").hide();
  $("#readabilityFontSize").hide();
  // $("#themeStyle").hide();
  $("#readabilityOff").hide();
});

// fixing embedding of local images
function fixingEmbeddingOfLocalImages($rtfContent, fileDirectory) {
  var hasURLProtocol = function(url) {
    return (
      url.indexOf("http://") === 0 ||
      url.indexOf("https://") === 0 ||
      url.indexOf("file://") === 0 ||
      url.indexOf("data:") === 0
    );
  };

  $rtfContent.find("img[src]").each(function() {
    var currentSrc = $(this).attr("src");
    if (!hasURLProtocol(currentSrc)) {
      var path = (isWeb ? "" : "file://") + fileDirectory + "/" + currentSrc;
      $(this).attr("src", path);
    }
  });

  $rtfContent.find("a[href]").each(function() {
    var currentSrc = $(this).attr("href");
    var path;

    if (!hasURLProtocol(currentSrc)) {
      var path = (isWeb ? "" : "file://") + fileDirectory + "/" + currentSrc;
      $(this).attr("href", path);
    }

    $(this).off();
    $(this).on('click', function(e) {
      e.preventDefault();
      if (path) {
        currentSrc = encodeURIComponent(path);
      }
      var msg = {command: "openLinkExternally", link: currentSrc};
      window.parent.postMessage(JSON.stringify(msg), "*");
    });
  });
}

function stringToBinaryArray(string) {
  var buffer = new ArrayBuffer(string.length);
  var bufferView = new Uint8Array(buffer);
  for (var i = 0; i < string.length; i++) {
    bufferView[i] = string.charCodeAt(i);
  }
  return buffer;
}

function setPictBorder(elem, show) {
  return elem.css("border", show ? "1px dotted red" : "none");
}

function setUnsafeLink(elem, warn) {
  return elem.css("border", warn ? "1px dashed red" : "none");
}

function displayRtfFile(blob) {
  try {
    var showPicBorder = $("#showpicborder").prop("checked");
    var warnHttpLinks = $("#warnhttplink").prop("checked");
    var settings = {
      onPicture: function(create) {
        var elem = create().attr("class", "rtfpict"); // WHY does addClass not work on <svg>?!
        return setPictBorder(elem, showPicBorder);
      },
      onHyperlink: function(create, hyperlink) {
        var url = hyperlink.url();
        var lnk = create();
        if (url.substr(0, 7) == "http://") {
          // Wrap http:// links into a <span>
          var span = setUnsafeLink($("<span>").addClass("unsafelink").append(lnk), warnHttpLinks);
          span.click(function(evt) {
            if ($("#warnhttplink").prop("checked")) {
              evt.preventDefault();
              alert("Unsafe link: " + url);
              return false;
            }
          });
          return {
            content: lnk,
            element: span
          };
        } else {
          return {
            content: lnk,
            element: lnk
          };
        }
      }
    };
    var doc = new RTFJS.Document(blob, settings);
    var haveMeta = false;
    var meta = doc.metadata();
    for (var prop in meta) {
      console.log(meta)
      $("#rtfContent").append($("<div>").append($("<span>").text(prop + ": ")).append($("<span>").text(meta[prop].toString())));
      haveMeta = true;
    }
    if (haveMeta) {
      $("#havemeta").show();
    }
    $("#rtfContent").empty().append(doc.render());
    $("#closebutton").show();
    $("#tools").show();
    console.log("All done!");
  } catch (e) {
    if (e instanceof RTFJS.Error) {
      console.log("Error: " + e.message);
      $("#content").text("Error: " + e.message);
    }
    else {
      throw e;
    }
  }
}

function setContent(content, fileDirectory, sourceURL) {
  $rtfContent = $("#rtfContent");

  displayRtfFile(stringToBinaryArray(content));

  if (fileDirectory.indexOf("file://") === 0) {
    fileDirectory = fileDirectory.substring(("file://").length, fileDirectory.length);
  }

  fixingEmbeddingOfLocalImages($rtfContent, fileDirectory);

  // View readability mode
  var readabilityViewer = document.getElementById("rtfContent");
  var fontSize = 14;
/*
  $("#readabilityOn").on('click', function() {
    try {
      var documentClone = document.cloneNode(true);
      var article = new Readability(document.baseURI, documentClone).parse();
      $(readabilityViewer).html(article.content);
      fixingEmbeddingOfLocalImages($(readabilityViewer, fileDirectory));
      readabilityViewer.style.fontSize = fontSize;//"large";
      readabilityViewer.style.fontFamily = "Helvetica, Arial, sans-serif";
      readabilityViewer.style.background = "#ffffff";
      readabilityViewer.style.color = "";
      $("#readabilityOff").css("display", "inline-block");
      //$("#themeStyle").show();
      $("#readabilityFont").show();
      $("#readabilityFontSize").show();
      $("#readabilityOn").hide();
      $("#changeStyleButton").hide();
      $("#resetStyleButton").hide();
      $("#zoomInButton").hide();
      $("#zoomOutButton").hide();
      $("#zoomResetButton").hide();
    } catch (e) {
      console.log("Error handling" + e);
      var msg = {
        command: "showAlertDialog",
        title: 'Readability Mode',
        message: 'This content can not be loaded.'
      };
      window.parent.postMessage(JSON.stringify(msg), "*");
    }
  });

  $("#readabilityOff").on('click', function() {
    $rtfContent.empty();
    $rtfContent.append(content);
    fixingEmbeddingOfLocalImages($rtfContent, fileDirectory);
    readabilityViewer.style.fontSize = '';//"large";
    readabilityViewer.style.fontFamily = "";
    readabilityViewer.style.color = "";
    readabilityViewer.style.background = "";
    $("#readabilityOn").show();
    $("#changeStyleButton").show();
    $("#resetStyleButton").show();
    $("#readabilityOff").hide();
    $("#readabilityFont").hide();
    $("#readabilityFontSize").hide();
    $("#themeStyle").hide();
  });
*/
  $("#toSansSerifFont").on('click', function(e) {
    e.stopPropagation();
    readabilityViewer.style.fontFamily = "Helvetica, Arial, sans-serif";
  });

  $("#toSerifFont").on('click', function(e) {
    e.stopPropagation();
    readabilityViewer.style.fontFamily = "Georgia, Times New Roman, serif";
  });

  $("#increasingFontSize").on('click', function(e) {
    e.stopPropagation();
    increaseFont();
  });

  $("#decreasingFontSize").on('click', function(e) {
    e.stopPropagation();
    decreaseFont();
  });

  $("#whiteBackgroundColor").on('click', function(e) {
    e.stopPropagation();
    readabilityViewer.style.background = "#ffffff";
    readabilityViewer.style.color = "";
  });

  $("#blackBackgroundColor").on('click', function(e) {
    e.stopPropagation();
    readabilityViewer.style.background = "#282a36";
    readabilityViewer.style.color = "#ffffff";
  });

  $("#sepiaBackgroundColor").on('click', function(e) {
    e.stopPropagation();
    readabilityViewer.style.color = "#5b4636";
    readabilityViewer.style.background = "#f4ecd8";
  });

  if (sourceURL) {
    $("#openSourceURL").show();
  } else {
    $("#openSourceURL").hide();
  }

  $('#openSourceURL').on('click', function() {
    sendMessageToHost({command: 'openLinkExternally', link: sourceURL});
  });

  function increaseFont() {
    try {
      var style = window.getComputedStyle(readabilityViewer, null).getPropertyValue('font-size');
      var fontSize = parseFloat(style);
      //if($('#readability-page-1').hasClass('page')){
      var page = document.getElementsByClassName("markdown");
      console.log(page[0].style);
      page[0].style.fontSize = (fontSize + 1) + 'px';
      page[0].style[11] = (fontSize + 1) + 'px';
      //} else {
      readabilityViewer.style.fontSize = (fontSize + 1) + 'px';
      //}
    } catch (e) {
      console.log('Error handling : ' + e);
      console.assert(e);
    }
  }

  function decreaseFont() {
    var style = window.getComputedStyle(readabilityViewer, null).getPropertyValue('font-size');
    var fontSize = parseFloat(style);
    readabilityViewer.style.fontSize = (fontSize - 1) + 'px';
  }

  Mousetrap.bind(['command++', 'ctrl++'], function(e) {
    increaseFont();
    return false;
  });

  Mousetrap.bind(['command+-', 'ctrl+-'], function(e) {
    decreaseFont();
    return false;
  });
}
