/* Copyright (c) 2013-present The TagSpaces Authors.
 * Use of this source code is governed by the MIT license which can be found in the LICENSE.txt file. */

/* globals marked, Readability, Mousetrap, initI18N, $, isWeb, sendMessageToHost */
'use strict';

sendMessageToHost({ command: 'loadDefaultTextContent' });

let $rtfContent;

$(document).ready(() => {
  const locale = getParameterByName('locale');
  const filePath = getParameterByName('file');
  const searchQuery = getParameterByName('query');
  let extSettings;

  initI18N(locale, 'ns.viewerRTF.json');
  loadExtSettings();

  $rtfContent = $('#rtfContent');

  const zoomSteps = [
    'zoomSmallest',
    'zoomSmaller',
    'zoomSmall',
    'zoomDefault',
    'zoomLarge',
    'zoomLarger',
    'zoomLargest'
  ];
  let currentZoomState = 3;
  if (extSettings && extSettings.zoomState) {
    currentZoomState = extSettings.zoomState;
  }

  $rtfContent.removeClass();
  $rtfContent.addClass('markdown ' + zoomSteps[currentZoomState]);

  $('#zoomInButton').on('click', () => {
    currentZoomState += 1;
    if (currentZoomState >= zoomSteps.length) {
      currentZoomState = 6;
    }
    $rtfContent.removeClass();
    $rtfContent.addClass('markdown ' + zoomSteps[currentZoomState]);
    saveExtSettings();
  });

  $('#zoomOutButton').on('click', () => {
    currentZoomState -= 1;
    if (currentZoomState < 0) {
      currentZoomState = 0;
    }
    $rtfContent.removeClass();
    $rtfContent.addClass('markdown ' + zoomSteps[currentZoomState]);
    saveExtSettings();
  });

  $('#zoomResetButton').on('click', () => {
    currentZoomState = 3;
    $rtfContent.removeClass();
    $rtfContent.addClass('markdown ' + zoomSteps[currentZoomState]);
    saveExtSettings();
  });

  function saveExtSettings() {
    const settings = {
      zoomState: currentZoomState
    };
    localStorage.setItem('viewerHTMLSettings', JSON.stringify(settings));
  }

  function loadExtSettings() {
    extSettings = JSON.parse(localStorage.getItem('viewerHTMLSettings'));
  }
});

// fixing embedding of local images
function fixingEmbeddingOfLocalImages($rtfContent, fileDirectory) {
  const hasURLProtocol = url =>
    url.indexOf('http://') === 0 ||
    url.indexOf('https://') === 0 ||
    url.indexOf('file://') === 0 ||
    url.indexOf('data:') === 0;

  $rtfContent.find('img[src]').each(() => {
    const currentSrc = $(this).attr('src');
    if (!hasURLProtocol(currentSrc)) {
      const path = (isWeb ? '' : 'file://') + fileDirectory + '/' + currentSrc;
      $(this).attr('src', path);
    }
  });

  $rtfContent.find('a[href]').each(() => {
    let currentSrc = $(this).attr('href');
    let path;

    if (!hasURLProtocol(currentSrc)) {
      const path1 = (isWeb ? '' : 'file://') + fileDirectory + '/' + currentSrc;
      $(this).attr('href', path1);
    }

    $(this).off();
    $(this).on('click', e => {
      e.preventDefault();
      if (path) {
        currentSrc = encodeURIComponent(path);
      }
      const msg = { command: 'openLinkExternally', link: currentSrc };
      sendMessageToHost(msg);
    });
  });
}

function stringToBinaryArray(string) {
  const buffer = new ArrayBuffer(string.length);
  const bufferView = new Uint8Array(buffer);
  for (let i = 0; i < string.length; i += 1) {
    bufferView[i] = string.charCodeAt(i);
  }
  return buffer;
}

function setPictBorder(elem, show) {
  return elem.css('border', show ? '1px dotted red' : 'none');
}

function setUnsafeLink(elem, warn) {
  return elem.css('border', warn ? '1px dashed red' : 'none');
}

function displayRtfFile(blob) {
  try {
    const showPicBorder = $('#showpicborder').prop('checked');
    const warnHttpLinks = $('#warnhttplink').prop('checked');
    const settings = {
      onPicture: create => {
        const elem = create().attr('class', 'rtfpict'); // WHY does addClass not work on <svg>?!
        return setPictBorder(elem, showPicBorder);
      },
      onHyperlink: (create, hyperlink) => {
        const url = hyperlink.url();
        const lnk = create();
        const span = setUnsafeLink(
          $('<span>')
            .addClass('unsafelink')
            .append(lnk),
          warnHttpLinks
        );
        span.click(evt => {
          evt.preventDefault();
          sendMessageToHost({ command: 'openLinkExternally', link: url });
        });
        return {
          content: lnk,
          element: span
        };
      }
    };
    const doc = new RTFJS.Document(blob, settings);
    let haveMeta = false;
    const meta = doc.metadata();
    for (let prop in meta) {
      console.log(meta);
      $('#rtfContent').append(
        $('<div>')
          .append($('<span>').text(prop + ': '))
          .append($('<span>').text(meta[prop].toString()))
      );
      haveMeta = true;
    }
    if (haveMeta) {
      $('#havemeta').show();
    }
    $('#rtfContent')
      .empty()
      .append(doc.render());
    $('#closebutton').show();
    $('#tools').show();
    console.log('All done!');
  } catch (e) {
    if (e instanceof RTFJS.Error) {
      console.log('Error: ' + e.message);
      $('#content').text('Error: ' + e.message);
    } else {
      throw e;
    }
  }
}

function setContent(content, fileDirectory) {
  $rtfContent = $('#rtfContent');

  displayRtfFile(stringToBinaryArray(content));

  if (fileDirectory.indexOf('file://') === 0) {
    fileDirectory = fileDirectory.substring(
      'file://'.length,
      fileDirectory.length
    );
  }

  fixingEmbeddingOfLocalImages($rtfContent, fileDirectory);

  function increaseFont() {
    try {
      let style = window
        .getComputedStyle(readabilityViewer, null)
        .getPropertyValue('font-size');
      let fontSize = parseFloat(style);
      //if($('#readability-page-1').hasClass('page')){
      let page = document.getElementsByClassName('markdown');
      console.log(page[0].style);
      page[0].style.fontSize = fontSize + 1 + 'px';
      page[0].style[11] = fontSize + 1 + 'px';
      //} else {
      readabilityViewer.style.fontSize = fontSize + 1 + 'px';
      //}
    } catch (e) {
      console.log('Error handling : ' + e);
      console.assert(e);
    }
  }

  function decreaseFont() {
    let style = window
      .getComputedStyle(readabilityViewer, null)
      .getPropertyValue('font-size');
    let fontSize = parseFloat(style);
    readabilityViewer.style.fontSize = fontSize - 1 + 'px';
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
