(async() => {
    const iceRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/;
    const cookiePrefixs = ['icp__', 'user__', 'c__session', 'sorry__', 'i__c__p'];
    const detectedPage = `<h1>道歉</h1><p>很道歉，因为我们的网站在中国大陆没有ICP许可证，为了避免法律风险，故暂时拒绝您所在地区的访客访问该网站或使用相关服务。</p>`;
    const detectedTitle = `很道歉，我们尚未得到ICP许可证。`;
    // handle functions
    let newTagName = () => {
        return cookiePrefixs[Math.floor(Math.random() * cookiePrefixs.length)] +
            Math.floor(Math.random() * 1000000).toString().replace('.', '_');
    };
    let isInPolygon = (checkPoint, polygonPoints) => {
        var counter = 0;
        var i;
        var xinters;
        var p1, p2;
        var pointCount = polygonPoints.length;
        p1 = polygonPoints[0];

        for (i = 1; i <= pointCount; i++) {
            p2 = polygonPoints[i % pointCount];
            if (
                checkPoint[0] > Math.min(p1[0], p2[0]) &&
                checkPoint[0] <= Math.max(p1[0], p2[0])
            ) {
                if (checkPoint[1] <= Math.max(p1[1], p2[1])) {
                    if (p1[0] != p2[0]) {
                        xinters =
                            (checkPoint[0] - p1[0]) *
                            (p2[1] - p1[1]) /
                            (p2[0] - p1[0]) +
                            p1[1];
                        if (p1[1] == p2[1] || checkPoint[1] <= xinters) {
                            counter++;
                        }
                    }
                }
            }
            p1 = p2;
        }
        if (counter % 2 == 0) {
            return false;
        } else {
            return true;
        }
    };
    let tagExists = () => {
        for (const cookiePrefix of cookiePrefixs) {
            if (document.cookie.includes(cookiePrefix)) {
                return true;
            }
        }
        return false;
    };
    let setTag = () => {
        var date = new Date();
        date.setTime(date.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days 
        document.cookie = newTagName() + '=' + newTagName() + ';expires=' + date.toGMTString();
        location.href = location.href;
    };
    let ipAddressHandler = async(ipAddress) => {
        let regionAddr = await fetch('https://geo.risk3sixty.com/' + ipAddress)
            .then(e => e.json());
        if (regionAddr.country == 'CN') {
            // set a cookie
            setTag();
        }
    };

    /**
     * @param {PositionCallback} geo 
     */
    let geoLocationHandler = async(geo) => {
        let geojsonCn = await fetch('https://raw.githubusercontent.com/yezongyang/china-geojson/master/china.json')
            .then(e => e.json());
        for (const feature of geojsonCn.features) {
            if (isInPolygon([geo.coords.longitude, geo.coords.latitude], feature.geometry.coordinates[0])) {
                setTag();
                break;
            }
        }
    };


    // Get the user's IP address
    let ipTests = [
        (async() => {
            // get ip address via google stun
            let conn = new RTCPeerConnection({
                iceServers: [{
                    urls: ['stun:stun.qq.com']
                }]
            })
            conn.addEventListener('icecandidate', e => {
                if (e.candidate) {
                    try {
                        let ipAddress = iceRegex.exec(e.candidate.candidate)[1];
                        ipAddressHandler(ipAddress);
                    } catch (e) { console.log(e); }
                }
            });
            conn.createDataChannel('rtcIpTest');
            conn.createOffer()
                .then(offer => conn.setLocalDescription(offer));
        }), (async() => {
            let ipAddress = await fetch('https://api.ipify.org?format=json')
                .then(res => res.json())
                .then(res => res.ip);
            ipAddressHandler(ipAddress);
        })
    ];

    let waitBodyLoad = () => {
        return new Promise((resolve, reject) => {
            let interval = setInterval(() => {
                if (document.body) {
                    clearInterval(interval);
                    resolve();
                }
            }, 100);
        });
    };
    let detected = async() => {
        // wait the body load
        await waitBodyLoad();
        document.body.innerHTML = detectedPage;
        document.head.innerHTML = `<meta charset="UTF-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${detectedTitle}</title>`;
    };

    // check tags exists
    if (tagExists()) {
        detected();
        return;
    }


    // run tests

    // check the geolocation
    (async() => {
        try {
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(geoLocationHandler);
            }
        } catch (e) {
            console.log(e);
        }
    })();

    // check language
    (async() => {
        if (navigator.language == 'zh-CN') {
            setTag();
        }
    })();

    // run ip tests
    let index = 0;
    const nextTest = () => {
        if (index >= ipTests.length) {
            return true;
        }
        try {
            ipTests[index]();
        } catch (e) {}
        index++;
        return false;
    };
    let interval = setInterval(() => {
        if (nextTest()) {
            clearInterval(interval);
        }
    }, 1000);

})();