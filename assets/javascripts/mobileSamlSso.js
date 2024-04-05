function handleRenewError(error) {
    console.error(error);
    return {
        accessToken: null,
        refreshToken: null,
    }
}

function handleRenewResponse(response) {
    return {
        accessToken: response.data.accessToken,
        refreshToken: response.headers['x-sumorea-remember-me']
    }
}

function renew() {
    return axios.get(window.location.origin + '/rest/v2/auth/renew')
        .then(handleRenewResponse)
        .catch(handleRenewError);
}

function storeToken(session) {
    window.cobundu.accessToken = session.accessToken;
    window.cobundu.refreshToken = session.refreshToken;
}

function notify() {
    var message = { event: 'getStoredToken', params: [window.cobundu.accessToken, window.cobundu.refreshToken] };
    var ssoMobileUrlWithHttps = window.cobundu.ssoMobileUrl ? 'https://' + window.cobundu.ssoMobileUrl : '';

    switch (window.cobundu.ssoMobileClient) {
        // SFSafariView in iOS App
        case "sfsafariviewcontroller":
        // Chrome Custom tab in Android App
        case "chromecustomtab":
            var launchURL = window.cobundu.ssoMobileUrl + "://accessToken=" + window.cobundu.accessToken + "&refreshToken=" + window.cobundu.refreshToken;
            window.location.href = launchURL;
            break;
        case "webbrowser":
            // Sends a postMessage to parent window with token as parameter.
            // Is used to enable SSO via iframe in standalone webapps.
            if (window.opener) {
                window.opener.postMessage(JSON.stringify(message), window.cobundu.ssoMobileUrl);
                window.close();
            }
            break;
        case 'office':
            Office.onReady(function () {
                Office.context.ui.messageParent(JSON.stringify(message), { targetOrigin: ssoMobileUrlWithHttps });
            });
            break;
        case 'officemacos':
            window.location.href = ssoMobileUrlWithHttps + "/popup.html?jwt=" + window.cobundu.accessToken + "&refreshToken=" + window.cobundu.refreshToken;
            break;
    }
}

window.cobundu = {
    accessToken: document.getElementsByName('access-token')[0].content,
    refreshToken: document.getElementsByName('refresh-token')[0].content,
    ssoMobileClient: document.getElementsByName('mobile-client')[0].content,
    ssoMobileUrl: document.getElementsByName('mobile-url')[0].content,

    getToken: function () {
        return renew().then(storeToken).then(function () {
            window.cobundu.getStoredToken();
        }).catch(window.cobundu.getStoredToken);
    },

    getStoredToken: function () {
        // Android WebView. cobundu_sso object will be injected from platfrom into the WebView.
        // When the below is called, native platorm will receive a callback.
        if (window.cobundu_sso) {
            window.cobundu_sso.getStoredToken(cobundu.accessToken, cobundu.refreshToken);
        } else {
            var message = "getStoredToken is not initialize! Please call appropriate function to initialize callbacks.";
            console.error(message);
            throw new Error(message);
        }
    },
};

window.mercury = {
    initIOS: function () {
        window.cobundu.getStoredToken = function () {
            window.webkit.messageHandlers.getStoredToken.postMessage(
                window.cobundu.accessToken
            );

            window.webkit.messageHandlers.getStoredTokens.postMessage(JSON.stringify({
                accessToken: window.cobundu.accessToken,
                refreshToken: window.cobundu.refreshToken
            }));
        }
    },
    initUWP: function () {
        window.cobundu.getStoredToken = function () {
            window.external.notify(
                JSON.stringify({
                    method: 'getStoredToken',
                    param: window.cobundu.accessToken,
                    params: [window.cobundu.accessToken, window.cobundu.refreshToken]
                })
            );
        }
    }
};

window.addEventListener('load', notify);
