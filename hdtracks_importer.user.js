// ==UserScript==
// @name           Import HDtracks releases into MusicBrainz
// @namespace      https://github.com/murdos/musicbrainz-userscripts/
// @description    One-click importing of releases from hdtracks.com into MusicBrainz.
// @version        2021.9.16.1
// @downloadURL    https://raw.githubusercontent.com/murdos/musicbrainz-userscripts/master/hdtracks_importer.user.js
// @updateURL      https://raw.githubusercontent.com/murdos/musicbrainz-userscripts/master/hdtracks_importer.user.js
// @match          *://www.hdtracks.com/
// @require        https://ajax.googleapis.com/ajax/libs/jquery/2.1.4/jquery.min.js
// @require        lib/mbimport.js
// @require        lib/mbimportstyle.js
// @icon           https://raw.githubusercontent.com/murdos/musicbrainz-userscripts/master/assets/images/Musicbrainz_import_logo.png
// @grant          GM_xmlhttpRequest
// ==/UserScript==

// prevent JQuery conflicts, see http://wiki.greasespot.net/@grant
this.$ = this.jQuery = jQuery.noConflict(true);

$(document).ready(function () {
    MBImportStyle();
    window.onhashchange = parsePage; // HDtracks is a single page app (SPA)
});

async function parsePage() {
    const releaseId = window.location.hash.match(/#\/album\/(.+)/)?.[1];
    if (!releaseId) return; // SPA currently shows a different type of page

    // our buttons might already be there since the SPA caches the previous page for "also available in"
    if (document.getElementById(`mb-import-ui-${releaseId}`)) return;

    const url = window.location.href;
    const apiUrl = `https://hdtracks.azurewebsites.net/api/v1/album/${releaseId}`;
    const response = await fetch(apiUrl);
    const release = parseHDtracksRelease(await response.json(), url);
    insertButtons(release, url);
}

function parseHDtracksRelease(data, releaseUrl) {
    const releaseDate = new Date(data.release);
    const release = {
        id: data.productId, // not used as release editor seed
        title: data.name,
        artist_credit: data.artists.map(name => ({ artist_name: name })),
        barcode: data.upc,
        labels: [{ name: data.label }],
        year: releaseDate.getFullYear(),
        month: releaseDate.getMonth() + 1,
        day: releaseDate.getDate(),
        comment: data.quality.replace(' · ', '/'),
        annotation: [data.cLine, data.pLine, '\n== Credits (HDtracks) ==\n', data.credits].join('\n'),
        discs: [],
        urls: [],
        packaging: 'None',
        status: 'official',
        script: 'Latn',
    };
    release.discs.push({
        // disc numbers of the tracks are not available for releases with multiple discs!
        format: 'Digital Media',
        tracks: data.tracks.map(track => ({
            number: track.index,
            title: track.name,
            artist_credit: [{ artist_name: track.mainArtist }], // TODO: try to split strings into multiple artists?
            duration: track.duration * 1000,
        })),
    });
    release.urls.push({
        link_type: MBImport.URL_TYPES.purchase_for_download,
        url: releaseUrl,
    });
    return release;
}

function insertButtons(release, releaseUrl) {
    const editNote = MBImport.makeEditNote(releaseUrl, 'HDtracks');
    const formParameters = MBImport.buildFormParameters(release, editNote);
    const importerUI = $(`<div id="mb-import-ui-${release.id}"  style="line-height: 2.5em">
        ${MBImport.buildFormHTML(formParameters)}
        ${MBImport.buildSearchButton(release)}
        </div>`).hide();

    $('div.page-current div.album-buttons-group').prepend(importerUI);
    importerUI.slideDown();
}