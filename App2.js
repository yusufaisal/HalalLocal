import React from "react";
import {Alert,
    Animated,
    AppState,
    Dimensions,
    FlatList,
    Image,
    ImageBackground,
    Linking,
    Picker,
    Platform,
    ScrollView,
    Text,
    ToastAndroid,
    TouchableWithoutFeedback,
    View,
    WebView,
    StatusBar,
    TouchableHighlight,
    TouchableNativeFeedback, BackHandler } from "react-native";
import {StackNavigator} from "react-navigation";
import {Location, MapView, Permissions} from "expo";
import {GooglePlacesAutocomplete} from "react-native-google-places-autocomplete";
import getDirections from "react-native-google-maps-directions";
import AppIntro from 'react-native-app-intro';
import debounce from "lodash.debounce";
import Carousel from 'react-native-snap-carousel';
import { styles } from './styles/beranda';
import { Loading } from './components/Loading';

// SWIPEABLE PARALLAX CAROUSEL
import SwipeableParallaxCarousel from 'react-native-swipeable-parallax-carousel';

// // APP INTRO
// import Intro from './components/Intro';
// import checkIfFirstLaunch from "./utils/firstLaunchCheck";

// CAROUSEL IMAGES
const carouselImages=[
    {
        "id": 0,
        "imagePath": "https://halallocal.com/assets/img/slide/slide_mobile_1.jpg",
    },
    {
        "id": 1,
        "imagePath": "https://halallocal.com/assets/img/slide/slide_mobile_2.jpg",
    },
    {
        "id": 2,
        "imagePath": "https://halallocal.com/assets/img/slide/slide_mobile_3.jpg",
    },
];

// TRIP URL
const trip_url = 'https://www.halallocal.com';

// INFO URL
const media_url = 'http://media.halallocal.com/';

// FEED URL
const feed_url = 'https://goo.gl/forms/9bUMMUBD4pEQtagC3';

// DEVICE WIDTH AND HEIGHT
const width = Dimensions.get('window').width;
const height = Dimensions.get('window').height;

const keyMap = "AIzaSyDXTkfRD1oPstyW00h3sjurP4LmDL8p-_E";
let log = "";
let id = "";
let lang = "en";
let lg = require('./lang/en.json');
let location, query;
let mosque, resto, prayer, qiblat;
const restodef = "https://maps.gstatic.com/mapfiles/place_api/icons/restaurant-71.png";
const mosquedef = "https://maps.gstatic.com/mapfiles/place_api/icons/worship_islam-71.png";
let menuopen = true;
let menuopen2 = true;


// For navigation between pages purposes
let navigate = ()=>{};

// Reset main variables' value
let reset = ()=>{
    mosque={markers: [], done: [false, false]};
    resto={markers: [], done: [false, false]};
    prayer={data: [], time: {month: new Date().getMonth()+1, year: new Date().getFullYear()}};
};

// Reformat date for tracking
const reformat_date = (date) => ("0" + date.getDate()).slice(-2) + "/" + ("0" + (date.getMonth() + 1)).slice(-2) + "/" + date.getFullYear() +
" " + ("0" + date.getHours()).slice(-2) + ":" + ("0" + date.getMinutes()).slice(-2) + ":" + ("0" + date.getSeconds()).slice(-2);

// Write the log (tracking)
let track = (desc) => {
    log += "[" + reformat_date(new Date()) + "] " + desc + "\n";
    Expo.FileSystem.writeAsStringAsync(Expo.FileSystem.documentDirectory + "HalalLocal/log.txt", log)
};

// Send data when the log is not empty (on app started and AppState == background/inactive
let sendData = () => {
    if (log !== "") {
        // Feedback form url
        fetch("https://docs.google.com/forms/d/e/1FAIpQLSfVceOWcWNfsrY8-s5GTYTABf3Z5hIyomE-wrmVigeX07bs-Q/formResponse?entry.2030268456=" + id + "&entry.1684739681=" + encodeURI(log)).then(() => {
            // Emptying the log after uploading data
            Expo.FileSystem.writeAsStringAsync(Expo.FileSystem.documentDirectory + "HalalLocal/log.txt", "").then(() => {
                log = "";
            }).catch(err => track("!! sendData() => write: " + err.message));
        }).catch(err => track("!! sendData() => fetch: " + err.message));
    }
};

// Calculate bearing to Kakbah using Haversine formula
let updateQiblat = () => {
    let kakbah = {latitude: 21.4224779, longitude: 39.8251832};
    let dLon = (kakbah.longitude - location.coords.longitude);
    let y = Math.sin(dLon) * Math.cos(kakbah.latitude);
    let x = Math.cos(location.coords.latitude) * Math.sin(kakbah.latitude) - Math.sin(location.coords.latitude)
        * Math.cos(kakbah.latitude) * Math.cos(dLon);
    let brng = Math.atan2(y, x) * 180 / Math.PI;
    return Math.round((brng + 360) % 360);
};

// Retrieve prayer time from API
let updatePrayer = (loc, time) => {
    // Refresh prayer schedule before update
    prayer.data = [];

    // Set with default value if not given
    if (!loc)
        loc = {lat: query.lat, lng: query.lng};
    if (!time)
        time = {month: new Date().getMonth()+1, year: new Date().getFullYear()};
    let ary = [];

    // Get prayer time from AlAdhan API
    fetch('http://api.aladhan.com/calendar?latitude='+loc.lat+'&longitude='+loc.lng+'&method=3&month='+time.month+'&year='+time.year)
        .then(resp => resp.json()).then(response => {
        // Reformat prayer time into var prayer
        for (let i in response.data)
            ary.push({key: ary.length+1, tgl: ary.length+1, sbh: response.data[i].timings.Fajr, dhr: response.data[i].timings.Dhuhr, asr: response.data[i].timings.Asr, mgr: response.data[i].timings.Maghrib, isy: response.data[i].timings.Isha});
        prayer = {time: time, data: ary};
    }).catch(err => {
        // If there is no internet connection
        track("!! updatePrayer: Check internet connection: " + err.message);
        prayer.data = -2;
    });
};

let getResto = (lat, lng, ctr) => {
    if (!lat)
        lat = query.lat;
    if (!lng)
        lng = query.lng;
    if (!ctr)
        ctr = query.ctr;
    // ToastAndroid.showWithGravity('Getting nearby resto from Halal Local database...',ToastAndroid.LONG,ToastAndroid.BOTTOM);

    let req = lat+","+lng;
    let arry = [];
    let clone = [];
    let nm = ["town", "locality", "adm2", "adm1"];
    fetch('https://spreadsheets.google.com/feeds/list/16-07sDLCbE8lA1n6KSDQi72t1bb40I32BdDPWnaxRQY/5/public/values?alt=json&sq=country="' + ctr + '"').then((resp) => {
        let data = JSON.parse(resp._bodyText).feed;
        if (data.entry) {
            let result = data.entry.reduce((p, n) => {
                let m = measure([req, n["gsx$latlng"]["$t"]]);
                return !p.length || m < p[0] ? [m, n["gsx$aggregate"]["$t"]] : p;
            }, []);
            fetch('https://spreadsheets.google.com/feeds/list/16-07sDLCbE8lA1n6KSDQi72t1bb40I32BdDPWnaxRQY/3/public/values?alt=json&sq=country="' + ctr + '" and ' + nm[result[1].split("-")[0]] + '="' + result[1].split("-")[1] + '"').then((resp) => {
                arry[0] = JSON.parse(resp._bodyText).feed.entry;
                if (! arry[0]) arry[0] = [];
                let clone2 = [];
                for (let i = 0; i < arry[0].length; i++) {
                    let m = measure([req, arry[0][i]["gsx$latlng"]["$t"]]);
                    if (m <= 5e4) {
                        if (!clone2.length)
                            clone2[0] = [m, "0:" + i];
                        else
                            for (let j = 0; j < clone2.length; j++) {
                                if (m < clone2[j][0]) {
                                    clone2.splice(j, 0, [m, "0:" + i]);
                                    if (clone2.length > 20)
                                        clone2.pop();
                                    break;
                                }
                                else if ((j == clone2.length - 1) && j < 19) {
                                    clone2[j + 1] = [m, "0:" + i];
                                    break;
                                }
                            }
                    }
                }
                clone[0] = clone2;
            }).catch(err => {resto = {markers: -2, done: [false,false]};});
        }
        else
            clone[0] = [];
    }).catch(err => {resto = {markers: -2, done: [false,false]};});
    fetch('https://spreadsheets.google.com/feeds/list/16-07sDLCbE8lA1n6KSDQi72t1bb40I32BdDPWnaxRQY/3/public/values?alt=json&sq=country="' + ctr + '" and adm2="" and locality="" and town=""').then((resp) => {
        arry[1] = JSON.parse(resp._bodyText).feed.entry;
        let clone2 = [];
        if (arry[1]) {
            for (let i = 0; i < arry[1].length; i++) {
                let m = measure([req, arry[1][i]["gsx$latlng"]["$t"]]);
                if (m <= 5e4) {
                    if (!clone2.length)
                        clone2[0] = [m, "1:" + i];
                    else
                        for (let j = 0; j < clone2.length; j++) {
                            if (m < clone2[j][0]) {
                                clone2.splice(j, 0, [m, "1:" + i]);
                                if (clone2.length > 20)
                                    clone2.pop();
                                break;
                            }
                            else if ((j == clone2.length - 1) && j < 19) {
                                clone2[j + 1] = [m, "1:" + i];
                                break;
                            }
                        }
                }
            }
        }
        clone[1] = clone2;
    }).catch(err => {resto = {markers: -2, done: [false,false]};});
    let int = setInterval(() => {
        if (resto.markers == -2)
            clearInterval(int);
        if (clone[0] && clone[1]){
            clearInterval(int);
            let clone3 = clone[0].concat(clone[1]);
            let clone4 = clone[0].length ? clone[0].slice(0) : clone[1].length ? clone[1].slice(0) : [];
            if (clone3.length>clone4.length) {
                for (let i = clone4.length; i < clone3.length; i++) {
                    for (let j = 0; j < clone4.length; j++) {
                        if (clone3[i][0] < clone4[j][0]) {
                            clone4.splice(j, 0, clone3[i]);
                            if (clone4.length > 20) {
                                clone4.pop();
                            }
                            break;
                        }
                        else if ((j == clone4.length - 1) && j < 19) {
                            clone4[j + 1] = clone3[i];
                            break;
                        }
                    }
                }
            }
            for (let i in clone4) {
                let temp = arry[clone4[i][1].split(":")[0]][clone4[i][1].split(":")[1]];
                let mlat = temp["gsx$latlng"]["$t"].split(",")[0]-0;
                let mlng = temp["gsx$latlng"]["$t"].split(",")[1]-0;
                if (mlat == lat)
                    mlat -= 0.000045;
                if (mlng == lng)
                    mlng -= 0.00003;
                resto.markers[resto.markers.length] = {
                    key: resto.markers.length,
                    coordinate: {
                        latitude: mlat,
                        longitude: mlng
                    },
                    distance: clone4[i][0],
                    text: temp["gsx$title"]["$t"],
                    source: temp["gsx$source"]["$t"],
                    type: "point",
                    photo: temp["gsx$image"]["$t"] != "#N/A" ? temp["gsx$image"]["$t"] : restodef,
                    open: null,
                    dir: {
                        source: {latitude: lat, longitude: lng}, destination: {
                            latitude: mlat,
                            longitude: mlng
                        }, params: [{key: "dirflg", value: "w"}]
                    }
                };
            }
            resto.done[1] = true;
        }
    }, 10);
};

let updateResto = (Q) => {
    if (!Q)
        Q = query;
    resto = {markers: [], done: [false, false]};

    let call = ()=>{
        fetch('https://spreadsheets.google.com/feeds/list/16-07sDLCbE8lA1n6KSDQi72t1bb40I32BdDPWnaxRQY/2/public/values?alt=json&sq=country="' + Q.ctr + '"').then((resp) => {
            let data = JSON.parse(resp._bodyText).feed.entry;
            if (data) {
                let source = data[0]["gsx$source"]["$t"];
                let keyword = '("'+encodeURIComponent(data[0]["gsx$keyword"]["$t"])+'")';
                for (let i=1; i<data.length; i++)
                    keyword += ' OR ("'+encodeURIComponent(data[i]["gsx$keyword"]["$t"])+'")';
                fetch("https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=" + Q.lat + "," + Q.lng + "&rankby=distance&keyword="+keyword+"&key=" + keyMap).then(resp => {
                    data = JSON.parse(resp._bodyInit).results;
                    for (let i in data) {
                        if (data[i].geometry.location.lat == Q.lat)
                            data[i].geometry.location.lat -= 0.000045;
                        if (data[i].geometry.location.lng == Q.lng)
                            data[i].geometry.location.lng -= 0.00003;
                        resto.markers[resto.markers.length] = {
                            key: resto.markers.length,
                            coordinate: {latitude: data[i].geometry.location.lat, longitude: data[i].geometry.location.lng},
                            distance: measure([Q.lat + "," + Q.lng, data[i].geometry.location.lat + "," + data[i].geometry.location.lng]),
                            text: data[i].name,
                            source: source,
                            type: "keyword",
                            photo: data[i].photos ? "https://maps.googleapis.com/maps/api/place/photo?maxwidth=300&photoreference=" + data[i].photos[0].photo_reference + "&key=" + keyMap : restodef,
                            open: data[i].opening_hours ? data[i].opening_hours.open_now : null,
                            dir: {
                                source: {latitude: Q.lat, longitude: Q.lng},
                                destination: {
                                    latitude: data[i].geometry.location.lat,
                                    longitude: data[i].geometry.location.lng
                                },
                                params: [{key: "dirflg", value: "w"}]
                            }
                        };
                    }
                }).catch(err => {
                    resto = {markers: -2, done: [false, false]};
                });
            }
            resto.done[0] = true;
        }).catch(err => {
            resto = {markers: -2, done: [false, false]};
        });
        getResto(Q.lat, Q.lng, Q.ctr);
    };

    if (!Q.ctr || Q.ctr == "") {
        getCountry(Q.lat, Q.lng).then(ctr => {
            Q.ctr = ctr;
            if (ctr == "")
                resto = {markers: -2, done: [false, false]};
            else {
                call();
            }
        });
    }
    else
        call();

};

let getMosque = (lat, lng, ctr) => {
    if (!lat)
        lat = query.lat;
    if (!lng)
        lng = query.lng;
    if (!ctr)
        ctr = query.ctr;
    // ToastAndroid.showWithGravity('Getting nearby mosque from Halal Local database...',ToastAndroid.LONG,ToastAndroid.BOTTOM);

    let req = lat+","+lng;
    let arry = [];
    let clone = [];
    let nm = ["town", "locality", "adm2", "adm1"];
    fetch('https://spreadsheets.google.com/feeds/list/16-07sDLCbE8lA1n6KSDQi72t1bb40I32BdDPWnaxRQY/6/public/values?alt=json&sq=country="' + ctr + '"').then((resp) => {
        let data = JSON.parse(resp._bodyText).feed;
        if (data.entry) {
            let result = data.entry.reduce((p, n) => {
                let m = measure([req, n["gsx$latlng"]["$t"]]);
                return !p.length || m < p[0] ? [m, n["gsx$aggregate"]["$t"]] : p;
            }, []);
            fetch('https://spreadsheets.google.com/feeds/list/16-07sDLCbE8lA1n6KSDQi72t1bb40I32BdDPWnaxRQY/4/public/values?alt=json&sq=country="' + ctr + '" and ' + nm[result[1].split("-")[0]] + '="' + result[1].split("-")[1] + '"').then((resp) => {
                arry[0] = JSON.parse(resp._bodyText).feed.entry;
                if (! arry[0]) arry[0] = [];
                let clone2 = [];
                for (let i = 0; i < arry[0].length; i++) {
                    let m = measure([req, arry[0][i]["gsx$latlng"]["$t"]]);
                    if (m <= 5e4) {
                        if (!clone2.length)
                            clone2[0] = [m, "0:" + i];
                        else
                            for (let j = 0; j < clone2.length; j++) {
                                if (m < clone2[j][0]) {
                                    clone2.splice(j, 0, [m, "0:" + i]);
                                    if (clone2.length > 20)
                                        clone2.pop();
                                    break;
                                }
                                else if ((j == clone2.length - 1) && j < 19) {
                                    clone2[j + 1] = [m, "0:" + i];
                                    break;
                                }
                            }
                    }
                }
                clone[0] = clone2;
            }).catch(err => {mosque = {markers: -2, done: [false,false]};});
        }
        else
            clone[0] = [];
    }).catch(err => {mosque = {markers: -2, done: [false,false]};});
    fetch('https://spreadsheets.google.com/feeds/list/16-07sDLCbE8lA1n6KSDQi72t1bb40I32BdDPWnaxRQY/4/public/values?alt=json&sq=country="' + ctr + '" and adm2="" and locality="" and town=""').then((resp) => {
        arry[1] = JSON.parse(resp._bodyText).feed.entry;
        let clone2 = [];
        if (arry[1]) {
            for (let i = 0; i < arry[1].length; i++) {
                let m = measure([req, arry[1][i]["gsx$latlng"]["$t"]]);
                if (m <= 5e4) {
                    if (!clone2.length)
                        clone2[0] = [m, "1:" + i];
                    else
                        for (let j = 0; j < clone2.length; j++) {
                            if (m < clone2[j][0]) {
                                clone2.splice(j, 0, [m, "1:" + i]);
                                if (clone2.length > 20)
                                    clone2.pop();
                                break;
                            }
                            else if ((j == clone2.length - 1) && j < 19) {
                                clone2[j + 1] = [m, "1:" + i];
                                break;
                            }
                        }
                }
            }
        }
        clone[1] = clone2;
    }).catch(err => {mosque = {markers: -2, done: [false,false]};});
    let int = setInterval(() => {
        if (mosque.markers == -2)
            clearInterval(int);
        if (clone[0] && clone[1]){
            clearInterval(int);
            let clone3 = clone[0].concat(clone[1]);
            let clone4 = clone[0].length ? clone[0].slice(0) : clone[1].length ? clone[1].slice(0) : [];
            if (clone3.length>clone4.length) {
                for (let i = clone4.length; i < clone3.length; i++) {
                    for (let j = 0; j < clone4.length; j++) {
                        if (clone3[i][0] < clone4[j][0]) {
                            clone4.splice(j, 0, clone3[i]);
                            if (clone4.length > 20) {
                                clone4.pop();
                            }
                            break;
                        }
                        else if ((j == clone4.length - 1) && j < 19) {
                            clone4[j + 1] = clone3[i];
                            break;
                        }
                    }
                }
            }
            for (let i in clone4) {
                let temp = arry[clone4[i][1].split(":")[0]][clone4[i][1].split(":")[1]];
                let mlat = temp["gsx$latlng"]["$t"].split(",")[0]-0;
                let mlng = temp["gsx$latlng"]["$t"].split(",")[1]-0;
                if (mlat == lat)
                    mlat -= 0.000045;
                if (mlng == lng)
                    mlng -= 0.00003;
                mosque.markers[mosque.markers.length] = {
                    key: mosque.markers.length,
                    coordinate: {
                        latitude: mlat,
                        longitude: mlng
                    },
                    distance: clone4[i][0],
                    text: temp["gsx$title"]["$t"],
                    source: temp["gsx$source"]["$t"],
                    type: "point",
                    photo: temp["gsx$image"]["$t"] != "#N/A" ? temp["gsx$image"]["$t"] : mosquedef,
                    open: null,
                    dir: {
                        source: {latitude: lat, longitude: lng}, destination: {
                            latitude: mlat,
                            longitude: mlng
                        }, params: [{key: "dirflg", value: "w"}]
                    }
                };
            }
            mosque.done[1] = true;
        }
    }, 10);
};

let updateMosque = (Q) => {
    if (!Q)
        Q = query;
    mosque = {markers: [], done: [false, false]};
    fetch("https://maps.googleapis.com/maps/api/place/nearbysearch/json?location="+Q.lat+","+Q.lng+"&rankby=distance&type=mosque&key="+keyMap).then(resp => {
        let data = JSON.parse(resp._bodyInit).results;
        for (let i in data) {
            if (data[i].geometry.location.lat == Q.lat)
                data[i].geometry.location.lat -= 0.000045;
            if (data[i].geometry.location.lng == Q.lng)
                data[i].geometry.location.lng -= 0.00003;
            mosque.markers[mosque.markers.length] = {
                key: mosque.markers.length,
                coordinate: {latitude: data[i].geometry.location.lat, longitude: data[i].geometry.location.lng},
                distance: measure([Q.lat+","+Q.lng,data[i].geometry.location.lat+","+data[i].geometry.location.lng]),
                text: data[i].name,
                source: "Google",
                type: "keyword",
                photo: data[i].photos ? "https://maps.googleapis.com/maps/api/place/photo?maxwidth=300&photoreference=" + data[i].photos[0].photo_reference + "&key=" + keyMap : mosquedef,
                open: data[i].opening_hours ? data[i].opening_hours.open_now : null,
                dir: {
                    source: {latitude: Q.lat, longitude: Q.lng},
                    destination: {latitude: data[i].geometry.location.lat, longitude: data[i].geometry.location.lng},
                    params: [{key: "dirflg", value: "w"}]
                }
            };
        }
        mosque.done[0] = true;
    }).catch(err => {mosque = {markers: -2, done: [false,false]};});

    if (!Q.ctr || Q.ctr == "") {
        getCountry(Q.lat, Q.lng).then(ctr => {
            if (ctr != "")
                getMosque(Q.lat, Q.lng, ctr);
            else
                mosque = {markers: -2, done: [false,false]};
        });
    }
    else
        getMosque(Q.lat, Q.lng, Q.ctr);
};

let getCountry = (lat, lng) => {
    return fetch("https://maps.googleapis.com/maps/api/geocode/json?key="+keyMap+"&latlng="+lat+","+lng).then(resp => {
        let data = JSON.parse(resp._bodyInit).results[0].address_components;
        for (let i in data)
            if (data[i].types.indexOf("country") != -1)
                return data[i].short_name;
    }).catch(err => {return ""})
};

// Retrieve data for all features. Given opt-out if needed
let fetchData = (Q, optout) => {
    // Set var query with new query
    query = Q;

    // Get country code of current query
    getCountry(query.lat, query.lng).then(ctr => {
        query.ctr = ctr;
        if (!optout || !optout.resto)
            updateResto(query);
        // Get nearest prayer space
        if (!optout || !optout.mosque)
            updateMosque(query);
    });

    // Get prayer time
    if (!optout || !optout.prayer)
        updatePrayer(query, prayer.time);

    // Get qibla
    if (!optout || !optout.qiblat)
        qiblat = updateQiblat();
};

let measure = (latlng) => {  // generally used geo measurement function
    let latlng1 = latlng[0].split(",");
    let latlng2 = latlng[1].split(",");
    let R = 6378.137; // Radius of earth in KM
    let dLat = latlng2[0] * Math.PI / 180 - latlng1[0] * Math.PI / 180;
    let dLon = latlng2[1] * Math.PI / 180 - latlng1[1] * Math.PI / 180;
    let a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(latlng1[0] * Math.PI / 180) * Math.cos(latlng2[0] * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    let d = R * c;
    return d * 1000; // meters
}

const { width: viewportWidth } = Dimensions.get('window');

function wp(percentage) {
    const value = percentage * viewportWidth / 120;
    return Math.round(value);
}

const slideWidth = wp(50);
const sliderItemHorizontalMargin = wp(1);

const sliderWidth = viewportWidth;
const sliderItemWidth = slideWidth + sliderItemHorizontalMargin * 2;

class Start extends React.Component {
    static navigationOptions = {
        title: 'Start'
    };

    render() {
        return (
            <ScrollView>
                <View style={styles.container}>
                    <TouchableWithoutFeedback
                        onPress={() => {
                            this.props.navigation.navigate('Home');
                        }}
                    >
                        <View style={styles.button}>
                            <Text style={styles.buttonText}>Start</Text>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </ScrollView>)
    }
}

// HOME
export class App extends React.Component {
    static navigationOptions = {
        header: null
    };

    constructor(props) {
        super(props);
        // Set default value
        this.state = {
            prayer: null,
            prayerTime: null,
            now: null,
            lg: lg,
            show: false,
            lgdone: false,
            intro: false
        };
        this.handleBackButtonClick = this.handleBackButtonClick.bind(this);
    }

    async componentWillMount() {
        // navigate('Masjid')
        // Check if settings.txt is exist
        await Expo.FileSystem.getInfoAsync(Expo.FileSystem.documentDirectory + "HalalLocal/settings.txt").then(resp => {
            if (!resp.exists) {
                this.setState({intro: true});
                // If not exist (it means first run on the device), create directory, 8-digit ID, settings.txt, and log.txt
                Expo.FileSystem.makeDirectoryAsync(Expo.FileSystem.documentDirectory + "HalalLocal").then(() => {
                    id = (Math.floor(10000000 + Math.random() * 90000000)).toString();
                    this.updateLang(lang);
                    Expo.FileSystem.writeAsStringAsync(Expo.FileSystem.documentDirectory + "HalalLocal/settings.txt", JSON.stringify({id: id, lang: lang})).then(() => {
                        Expo.FileSystem.writeAsStringAsync(Expo.FileSystem.documentDirectory + "HalalLocal/log.txt", "").then()
                            .catch(err => {track("!! First saving data => write log.txt: " + err.message);
                                this.updateLang(lang);
                            });
                    }).catch(err => {track("!! First saving data => write settings.txt: " + err.message);
                        this.updateLang(lang);
                    });
                }).catch(err => {track("!! First saving data => create HalalLocal directory: " + err.message);
                    this.updateLang(lang);
                });
            }
            else {
                // If settings.txt exist (it means app has been run previously), get ID, language, log, and upload log if log is not empty
                Expo.FileSystem.readAsStringAsync(Expo.FileSystem.documentDirectory + "HalalLocal/settings.txt").then(setting => {
                    let set = JSON.parse(setting);
                    id = set.id;
                    lang = set.lang;
                    this.updateLang(lang);
                    Expo.FileSystem.readAsStringAsync(Expo.FileSystem.documentDirectory + "HalalLocal/log.txt").then(logs => {
                        log = logs;
                        sendData();
                    }).catch(err => {track("!! First checking data => read log.txt: " + err.message);
                        this.updateLang(lang);
                    });
                }).catch(err => {track("!! First checking data => read settings.txt: " + err.message);
                    this.updateLang(lang);
                });
            }
        }).catch(err => {track("!! First checking data => check if settings.txt exist: " + err.message);
            this.updateLang(lang);
        });
        BackHandler.addEventListener('hardwareBackPress', this.handleBackButtonClick);
    }

    async componentDidMount() {
        // Listen when AppState is changed (foreground, background, or inactive)
        AppState.addEventListener('change', this._handleAppStateChange);

        reset();

        // Ask location permission
        let {status} = await Permissions.askAsync(Permissions.LOCATION);
        if (status == "granted") {
            // If granted, get current location
            location = await Location.getCurrentPositionAsync({enableHighAccuracy:true});
            // Location is obtained if there is internet connection or phone signal (whether GPS on or off). Otherwise, it will continue to wait until there is internet connection/phone signal

            // Fetch data based on current location
            fetchData({lat: location.coords.latitude, lng: location.coords.longitude, q: "Current location"});

            this.getResto();
            this.getMosque();
            // Get prayer time for Home screen
            this.getPrayer();
            // Update prayer time periodically
            this.intPrayer();
        }
        else {
            track("!! Home: Tidak diberikan permission atas location");
            ToastAndroid.show(this.state.lg.alert.nolocation, ToastAndroid.SHORT);
            resto.markers = -1;
            // To differentiate if the permission is not granted then need to get current location again on menu Mosque
            mosque.markers = -1;
            // To differentiate if the permission is not granted then need to get current location again on menu Prayer Time
            prayer.data = -1;
            // To differentiate if the permission is not granted then need to get current location again on menu Qiblat
            qiblat = -1;
            // Set value if the location permission is not granted
            this.setState({resto:-1});
            this.setState({mosque:-1});
            this.setState({prayer:-1});


            let int = setInterval(() => {
                if (this.intLoc() == "granted"){
                    clearInterval(int);
                    this.updateResto();
                    this.updateMosque();
                    this.intPrayer();
                }
            }, 30000);
        }
    }

    componentWillUnmount() {
        // Remove event listener if the app is killed
        AppState.removeEventListener('change', this._handleAppStateChange);
        BackHandler.removeEventListener('hardwareBackPress', this.handleBackButtonClick);
    }

    shouldComponentUpdate(a,b) {
        return !this.state.intro;
    }

    // Trigger if AppState changed
    _handleAppStateChange = (nextAppState) => {
        // If the app goes background or in transition (inactive)
        if (nextAppState.match(/inactive|background/)) {
            // Report the log (tracking)
            sendData();
        }
    };

    handleBackButtonClick() {
        if (this.state.show) {
            this.setState({show: false});
            return true;
        }
    }

    intPrayer() {
        let int = setInterval(() => {
            let date = ("0" + new Date().getHours()).slice(-2) + ":" + ("0" + new Date().getMinutes()).slice(-2);
            if (this.state.prayerTime == null || date == "00:00")
                this.getPrayer();
            else if (date == this.state.prayer.next[1])
                this.updatePrayer();
            else
                this.getTimeDiff(this.state.prayer);
        }, 10000);
    }

    async intLoc() {
        let {status} = await Permissions.askAsync(Permissions.LOCATION);
        if (status == "granted")
            location = await Location.getCurrentPositionAsync({enableHighAccuracy:true});
        else {
            this.setState({prayer: -1});
            this.setState({mosque: -1});
        }
        return status;
    }

    getPrayer() {
        let date = new Date();
        fetch("http://api.aladhan.com/timings/"+date.getDate()+"-"+(date.getMonth()+1)+"-"+date.getFullYear()+"?latitude="+location.coords.latitude+"&longitude="+location.coords.longitude+"&method=3")
            .then(resp => {
                let prayer = {};
                let time = JSON.parse(resp._bodyText).data.timings;
                for (let key in time){
                    if (!key.match(/Sunrise|Sunset|Imsak|Midnight/)) {
                        if (("0" + date.getHours()).slice(-2) + ":" + ("0" + date.getMinutes()).slice(-2) >= time[key]) {
                            prayer.now = [key.toLowerCase(), time[key]];
                        }
                        else if (prayer.now){
                            prayer.next = [key.toLowerCase(), time[key]];
                            break;
                        }
                    }
                }
                if (prayer.now == null)
                    prayer.now = ["isha", time.Isha];
                if (prayer.next == null)
                    prayer.next = ["fajr", time.Fajr];
                this.setState({prayerTime: time, isCarouselLoaded: true});
                this.getTimeDiff(prayer);
            })
            .catch((err) => {
                console.log(err.message);
                track("!! Home: Tidak terkoneksi pada internet (getPrayer())");
                this.setState({prayer:-2});
            })
    }

    getTimeDiff(prayer){
        let time = ("0" + new Date().getHours()).slice(-2) + ":" + ("0" + new Date().getMinutes()).slice(-2);
        let diff;
        if (time > prayer.next[1])
            diff = (parseInt(prayer.next[1].split(":")[0])*60+parseInt(prayer.next[1].split(":")[1])) + ((24*60) - (parseInt(time.split(":")[0])*60+parseInt(time.split(":")[1])))
        else
            diff = (parseInt(prayer.next[1].split(":")[0])*60+parseInt(prayer.next[1].split(":")[1])) - (parseInt(time.split(":")[0])*60+parseInt(time.split(":")[1]));
        this.setState({now: time});
        this.setState({prayer: {now: prayer.now, next: prayer.next, diff: [Math.floor(diff/60), diff%60]}});
    }

    updatePrayer(){
        let date = new Date();
        let time = this.state.prayerTime;
        for (let key in time){
            if (!key.match(/Sunrise|Sunset|Imsak|Midnight/)) {
                if (("0" + date.getHours()).slice(-2) + ":" + ("0" + date.getMinutes()).slice(-2) >= time[key]) {
                    prayer.now = [key.toLowerCase(), time[key]];
                }
                else if (prayer.now){
                    prayer.next = [key.toLowerCase(), time[key]];
                    break;
                }
            }
        }
        if (prayer.now == null)
            prayer.now = ["isha", time.Isha];
        if (prayer.next == null)
            prayer.next = ["fajr", time.Fajr];
        this.getTimeDiff(prayer);
    }

    getResto() {
        let int = setInterval(()=>{
            if (resto.markers == -2) {
                clearInterval(int);
                this.setState({resto: resto.markers});
                this.updateResto();
            }
            if (resto.done.every(t => t)){
                clearInterval(int);
                if(query.q == "Current location"){
                    if (!resto.markers.length)
                        this.setState({resto: -3});
                    else {
                        let artemp = resto.markers.map((n,i)=>[i,n.distance]);
                        artemp.sort((a,b)=>a[1]-b[1]);
                        let temp = artemp.slice(0,5).map(n=>resto.markers[n[0]]);
                        this.textResto(temp);
                    }
                }
                else
                    this.updateResto();
            }
        },100);
    }

    updateResto() {
        let process = true;
        let int = setInterval(()=>{
            if (process) {
                process = false;
                let error = false;
                getCountry(location.coords.latitude, location.coords.longitude).then(ctr => {
                    if (ctr == "")
                        process = true;
                    else {
                        this.setState({resto:null});
                        process = false;
                        let arys = [];
                        let done = [false, false, false];
                        fetch('https://spreadsheets.google.com/feeds/list/16-07sDLCbE8lA1n6KSDQi72t1bb40I32BdDPWnaxRQY/2/public/values?alt=json&sq=country="' + ctr + '"').then((resp) => {
                            let data = JSON.parse(resp._bodyText).feed.entry;
                            if (data) {
                                let source = data[0]["gsx$source"]["$t"];
                                let keyword = '("'+encodeURIComponent(data[0]["gsx$keyword"]["$t"])+'")';
                                for (let i=1; i<data.length; i++)
                                    keyword += ' OR ("'+encodeURIComponent(data[i]["gsx$keyword"]["$t"])+'")';
                                fetch("https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=" + location.coords.latitude + "," + location.coords.longitude + "&rankby=distance&keyword="+keyword+"&key=" + keyMap).then(resp => {
                                    data = JSON.parse(resp._bodyInit).results;
                                    for (let i=0; i<5; i++) {
                                        if (data[i].geometry.location.lat == location.coords.latitude)
                                            data[i].geometry.location.lat -= 0.000045;
                                        if (data[i].geometry.location.lng == location.coords.longitude)
                                            data[i].geometry.location.lng -= 0.00003;
                                        arys[arys.length] = {
                                            key: arys.length,
                                            coordinate: {latitude: data[i].geometry.location.lat, longitude: data[i].geometry.location.lng},
                                            distance: measure([location.coords.latitude + "," + location.coords.longitude, data[i].geometry.location.lat + "," + data[i].geometry.location.lng]),
                                            text: data[i].name,
                                            source: source,
                                            type: "keyword",
                                            photo: data[i].photos ? "https://maps.googleapis.com/maps/api/place/photo?maxwidth=300&photoreference=" + data[i].photos[0].photo_reference + "&key=" + keyMap : restodef,
                                            open: data[i].opening_hours ? data[i].opening_hours.open_now : null,
                                            dir: {
                                                source: {latitude: location.coords.latitude, longitude: location.coords.longitude},
                                                destination: {
                                                    latitude: data[i].geometry.location.lat,
                                                    longitude: data[i].geometry.location.lng
                                                },
                                                params: [{key: "dirflg", value: "w"}]
                                            }
                                        };
                                    }
                                }).catch(err => {
                                    error = true;
                                });
                            }
                            done[0] = true;
                        }).catch(err => {
                            error = true;
                        });

                        let req = location.coords.latitude+","+location.coords.longitude;
                        let nm = ["town", "locality", "adm2", "adm1"];
                        fetch('https://spreadsheets.google.com/feeds/list/16-07sDLCbE8lA1n6KSDQi72t1bb40I32BdDPWnaxRQY/5/public/values?alt=json&sq=country="' + ctr + '"').then((resp) => {
                            let data = JSON.parse(resp._bodyText).feed;
                            if (data.entry) {
                                let result = data.entry.reduce((p, n) => {
                                    let m = measure([req, n["gsx$latlng"]["$t"]]);
                                    return !p.length || m < p[0] ? [m, n["gsx$aggregate"]["$t"]] : p;
                                }, []);
                                fetch('https://spreadsheets.google.com/feeds/list/16-07sDLCbE8lA1n6KSDQi72t1bb40I32BdDPWnaxRQY/3/public/values?alt=json&sq=country="' + ctr + '" and ' + nm[result[1].split("-")[0]] + '="' + result[1].split("-")[1] + '"').then((resp) => {
                                    let data = JSON.parse(resp._bodyText).feed.entry;
                                    let clone2 = [];
                                    if (data) {
                                        for (let i = 0; i < data.length; i++) {
                                            let m = measure([req, data[i]["gsx$latlng"]["$t"]]);
                                            if (m <= 5e4) {
                                                if (!clone2.length)
                                                    clone2[0] = [m, i];
                                                else
                                                    for (let j = 0; j < clone2.length; j++) {
                                                        if (m < clone2[j][0]) {
                                                            clone2.splice(j, 0, [m, i]);
                                                            if (clone2.length > 5)
                                                                clone2.pop();
                                                            break;
                                                        }
                                                        else if ((j == clone2.length - 1) && j < 4) {
                                                            clone2[j + 1] = [m, i];
                                                            break;
                                                        }
                                                    }
                                            }
                                        }
                                        for (let i = 0; i < clone2.length; i++) {
                                            let ltng = data[clone2[i][1]]["gsx$latlng"]["$t"].split(",");
                                            arys[arys.length] = {
                                                key: arys.length,
                                                coordinate: {
                                                    latitude: ltng[0] - 0,
                                                    longitude: ltng[1] - 0
                                                },
                                                distance: clone2[i][0],
                                                text: data[clone2[i][1]]["gsx$title"]["$t"],
                                                source: data[clone2[i][1]]["gsx$source"]["$t"],
                                                type: "point",
                                                photo: data[clone2[i][1]]["gsx$image"]["$t"] != "#N/A" ? data[clone2[i][1]]["gsx$image"]["$t"] : restodef,
                                                open: null,
                                                dir: {
                                                    source: {
                                                        latitude: location.coords.latitude,
                                                        longitude: location.coords.longitude
                                                    },
                                                    destination: {
                                                        latitude: ltng[0] - 0,
                                                        longitude: ltng[1] - 0
                                                    },
                                                    params: [{key: "dirflg", value: "w"}]
                                                }
                                            };
                                        }
                                    }
                                    done[1] = true;
                                }).catch(err => {error = true;});
                            }
                            else
                                done[1] = true;
                        }).catch(err => {error = true;});
                        fetch('https://spreadsheets.google.com/feeds/list/16-07sDLCbE8lA1n6KSDQi72t1bb40I32BdDPWnaxRQY/3/public/values?alt=json&sq=country="' + ctr + '" and adm2="" and locality="" and town=""').then((resp) => {
                            let data = JSON.parse(resp._bodyText).feed.entry;
                            let clone2 = [];
                            if (data) {
                                for (let i = 0; i < data.length; i++) {
                                    let m = measure([req, data[i]["gsx$latlng"]["$t"]]);
                                    if (m <= 5e4) {
                                        if (!clone2.length)
                                            clone2[0] = [m, i];
                                        else
                                            for (let j = 0; j < clone2.length; j++) {
                                                if (m < clone2[j][0]) {
                                                    clone2.splice(j, 0, [m, i]);
                                                    if (clone2.length > 5)
                                                        clone2.pop();
                                                    break;
                                                }
                                                else if ((j == clone2.length - 1) && j < 4) {
                                                    clone2[j + 1] = [m, i];
                                                    break;
                                                }
                                            }
                                    }
                                }
                                for (let i = 0; i < clone2.length; i++) {
                                    let ltng = data[clone2[i][1]]["gsx$latlng"]["$t"].split(",");
                                    arys[arys.length] = {
                                        key: arys.length,
                                        coordinate: {
                                            latitude: ltng[0] - 0,
                                            longitude: ltng[1] - 0
                                        },
                                        distance: clone2[i][0],
                                        text: data[clone2[i][1]]["gsx$title"]["$t"],
                                        source: data[clone2[i][1]]["gsx$source"]["$t"],
                                        type: "point",
                                        photo:data[clone2[i][1]]["gsx$image"]["$t"] != "#N/A" ? data[clone2[i][1]]["gsx$image"]["$t"] : restodef,
                                        open: null,
                                        dir: {
                                            source: {
                                                latitude: location.coords.latitude,
                                                longitude: location.coords.longitude
                                            },
                                            destination: {
                                                latitude: ltng[0] - 0,
                                                longitude: ltng[1] - 0
                                            },
                                            params: [{key: "dirflg", value: "w"}]
                                        }
                                    };
                                }
                            }
                            done[2] = true;
                        }).catch(err => {error = true;});
                        let int2 = setInterval(() => {
                            if (error) {
                                clearInterval(int2);
                                process = true;
                            }
                            if (done.every(t => t)) {
                                clearInterval(int);
                                clearInterval(int2);
                                if (!arys.length)
                                    this.setState({resto: -3});
                                else {
                                    let artemp = arys.map((n,i)=>[i,n.distance]);
                                    artemp.sort((a,b)=>a[1]-b[1]);
                                    let temp = artemp.slice(0,5).map(n=>{
                                        if (arys[n[0]].coordinate.latitude == location.coords.latitude)
                                            arys[n[0]].coordinate.latitude -= 0.000045;
                                        if (arys[n[0]].coordinate.longitude == location.coords.longitude)
                                            arys[n[0]].coordinate.longitude -= 0.00003;
                                        return arys[n[0]];
                                    });
                                    this.textResto(temp);
                                }
                            }
                        }, 100);
                    }
                }).catch(err => {
                    process = true;
                });
            }
        },100);

    }

    textResto(arr){
        this.setState({resto: null});
        let int = setInterval(()=>{
            if (lang == this.state.lg.lang) {
                clearInterval(int);
                for (let i=0; i<arr.length; i++){
                    arr[i].distance2 = this.state.lg.list.distance+": ~"+Math.round(arr[i].distance/100)/10 + this.state.lg.list.km;
                    arr[i].source2 = this.state.lg.list.source+": "+arr[i].source;
                    arr[i].tap = this.state.lg.list.tapdirection;
                }
                this.setState({resto: arr});
            }
        },10);
    }

    getMosque() {
        let int = setInterval(()=>{
            if (mosque.markers == -2) {
                clearInterval(int);
                this.setState({mosque: mosque.markers});
                this.updateMosque();
            }
            if (mosque.done.every(t => t)){
                clearInterval(int);
                if(query.q == "Current location"){
                    if (!mosque.markers.length)
                        this.setState({mosque: -3});
                    else {
                        let min = [0,mosque.markers[0].distance];
                        for (let i=1; i<mosque.markers.length; i++)
                            if (mosque.markers[i].distance < min[1])
                                min = [i,mosque.markers[i].distance];
                        this.setState({mosque: mosque.markers[min[0]]},
                            () => {
                                setTimeout(() => {
                                    if (this.map && location && location.coords && location.coords.latitude && location.coords.longitude)
                                        this.map.fitToElements(false);
                                    else {
                                        let int2 = setInterval(() => {
                                            if (this.map && location && location.coords && location.coords.latitude && location.coords.longitude) {
                                                clearInterval(int2);
                                                this.map.fitToElements(false);
                                            }
                                        }, 100)
                                    }
                                }, 1000)
                            }
                        );
                    }
                }
                else
                    this.updateMosque();
            }
        },100);
    }

    updateMosque() {
        let process = true;
        let int = setInterval(()=>{
            if (process) {
                let error = false;
                fetch("https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=" + location.coords.latitude + "," + location.coords.longitude + "&rankby=distance&type=mosque&key=" + keyMap).then(resp => {
                    this.setState({mosque:null});
                    process = false;
                    let max;
                    let data = JSON.parse(resp._bodyInit).results;
                    if (data && data.length > 0) {
                        max = {
                            key: 0,
                            coordinate: {
                                latitude: data[0].geometry.location.lat,
                                longitude: data[0].geometry.location.lng
                            },
                            distance: measure([location.coords.latitude + "," + location.coords.longitude, data[0].geometry.location.lat + "," + data[0].geometry.location.lng]),
                            text: data[0].name,
                            source: "Google",
                            type: "keyword",
                            photo: data[0].photos ? "https://maps.googleapis.com/maps/api/place/photo?maxwidth=300&photoreference=" + data[0].photos[0].photo_reference + "&key=" + keyMap : mosquedef,
                            open: data[0].opening_hours ? data[0].opening_hours.open_now : null,
                            dir: {
                                source: {latitude: location.coords.latitude, longitude: location.coords.longitude},
                                destination: {
                                    latitude: data[0].geometry.location.lat,
                                    longitude: data[0].geometry.location.lng
                                },
                                params: [{key: "dirflg", value: "w"}]
                            }
                        };
                    }
                    getCountry(location.coords.latitude, location.coords.longitude).then(ctr => {
                        if (ctr == "")
                            error = true;
                        else {
                            let req = location.coords.latitude + "," + location.coords.longitude;
                            let nm = ["town", "locality", "adm2", "adm1"];
                            let maxs = [max, max];
                            let done = [false, false];
                            fetch('https://spreadsheets.google.com/feeds/list/16-07sDLCbE8lA1n6KSDQi72t1bb40I32BdDPWnaxRQY/6/public/values?alt=json&sq=country="' + ctr + '"').then((resp) => {
                                let data = JSON.parse(resp._bodyText).feed;
                                if (data.entry) {
                                    let result = data.entry.reduce((p, n) => {
                                        let m = measure([req, n["gsx$latlng"]["$t"]]);
                                        return !p.length || m < p[0] ? [m, n["gsx$aggregate"]["$t"]] : p;
                                    }, []);
                                    fetch('https://spreadsheets.google.com/feeds/list/16-07sDLCbE8lA1n6KSDQi72t1bb40I32BdDPWnaxRQY/4/public/values?alt=json&sq=country="' + ctr + '" and ' + nm[result[1].split("-")[0]] + '="' + result[1].split("-")[1] + '"').then((resp) => {
                                        let arry = JSON.parse(resp._bodyText).feed.entry;
                                        if (arry)
                                            for (let i = 0; i < arry.length; i++) {
                                                let m = measure([req, arry[i]["gsx$latlng"]["$t"]]);
                                                if (m <= 5e4)
                                                    if (!maxs[0] || m < maxs[0].distance) {
                                                        let latlng = arry[i]["gsx$latlng"]["$t"].split(",");
                                                        maxs[0] = {
                                                            key: 0,
                                                            coordinate: {
                                                                latitude: latlng[0] - 0,
                                                                longitude: latlng[1] - 0
                                                            },
                                                            distance: m,
                                                            text: arry[i]["gsx$title"]["$t"],
                                                            source: arry[i]["gsx$source"]["$t"],
                                                            type: "point",
                                                            photo: arry[i]["gsx$image"]["$t"] != "#N/A" ? arry[i]["gsx$image"]["$t"] : mosquedef,
                                                            open: null,
                                                            dir: {
                                                                source: {
                                                                    latitude: location.coords.latitude,
                                                                    longitude: location.coords.longitude
                                                                }, destination: {
                                                                    latitude: latlng[0] - 0,
                                                                    longitude: latlng[1] - 0
                                                                }, params: [{key: "dirflg", value: "w"}]
                                                            }
                                                        };
                                                    }
                                            }
                                        done[0] = true;
                                    }).catch(err => {
                                        error = true;
                                    });
                                }
                                else
                                    done[0] = true;
                            }).catch(err => {
                                error = true;
                            });
                            fetch('https://spreadsheets.google.com/feeds/list/16-07sDLCbE8lA1n6KSDQi72t1bb40I32BdDPWnaxRQY/4/public/values?alt=json&sq=country="' + ctr + '" and adm2="" and locality="" and town=""').then((resp) => {
                                let arry = JSON.parse(resp._bodyText).feed.entry;
                                if (arry)
                                    for (let i = 0; i < arry.length; i++) {
                                        let m = measure([req, arry[i]["gsx$latlng"]["$t"]]);
                                        if (m <= 5e4)
                                            if (!maxs[1] || m < maxs[1].distance) {
                                                let latlng = arry[i]["gsx$latlng"]["$t"].split(",");
                                                maxs[1] = {
                                                    key: 0,
                                                    coordinate: {
                                                        latitude: latlng[0] - 0,
                                                        longitude: latlng[1] - 0
                                                    },
                                                    distance: m,
                                                    text: arry[i]["gsx$title"]["$t"],
                                                    source: arry[i]["gsx$source"]["$t"],
                                                    type: "point",
                                                    photo: arry[i]["gsx$image"]["$t"] != "#N/A" ? arry[i]["gsx$image"]["$t"] : mosquedef,
                                                    open: null,
                                                    dir: {
                                                        source: {
                                                            latitude: location.coords.latitude,
                                                            longitude: location.coords.longitude
                                                        }, destination: {
                                                            latitude: latlng[0] - 0,
                                                            longitude: latlng[1] - 0
                                                        }, params: [{key: "dirflg", value: "w"}]
                                                    }
                                                };
                                            }
                                    }
                                done[1] = true;
                            }).catch(err => {
                                error = true;
                            });
                            let int2 = setInterval(() => {
                                if (error) {
                                    clearInterval(int2);
                                    process = true;
                                }
                                if (done.every(t => t)) {
                                    clearInterval(int);
                                    clearInterval(int2);
                                    if (!maxs[0] && !maxs[1])
                                        this.setState({mosque: -3});
                                    else {
                                        if (!maxs[0])
                                            this.setState({mosque: maxs[1]});
                                        else if (!maxs[1])
                                            this.setState({mosque: maxs[0]});
                                        else {
                                            let temp = maxs[0].distance < maxs[1].distance ? maxs[0] : maxs[1];
                                            if (temp.coordinate.latitude == location.coords.latitude)
                                                temp.coordinate.latitude -= 0.000045;
                                            if (temp.coordinate.longitude == location.coords.longitude)
                                                temp.coordinate.longitude -= 0.00003;
                                            this.setState({mosque: temp});
                                        }
                                        setTimeout(()=>{
                                            if (this.map && location && location.coords && location.coords.latitude && location.coords.longitude)
                                                this.map.fitToElements(false);
                                            else {
                                                let int2 = setInterval(() => {
                                                    if (this.map && location && location.coords && location.coords.latitude && location.coords.longitude){
                                                        clearInterval(int2);
                                                        this.map.fitToElements(false);
                                                    }
                                                }, 100)
                                            }
                                        },1000);
                                    }
                                }
                            }, 100);
                        }
                    });
                }).catch(err => {
                    process = true;
                });
            }
        },1000);

    }

    // Isi slide resto //
    renderListComponent = ({ item })  => {
        const content = (<View style={{flexDirection:"column", width: 155}}>
            <View style={{alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                width: 153, height: 130, borderRadius: 5}}>
                <Image style={{width: 153, height: 130, borderRadius: 5, resizeMode: item.photo != restodef ? 'cover' : 'contain'}}
                       source={item.photo != restodef ? {uri: item.photo} : require('./img/png/ic_resto.png')} />
            </View>
            <View style={styles.buttonDirection}>
                <View style={styles.buttonTextStyle}>
                    <Text style={styles.buttonTextDirection}>{item.distance2}</Text>
                </View>
            </View>
            <View>
                <View style={{width: 160, justifyContent:'center', backgroundColor:"transparent"}}>
                    <View style={{paddingHorizontal:6}}>
                        <Text style={{fontWeight: 'bold', fontSize: 12, color:'#686868'}}>{item.text.length > 20 ? item.text.slice(0,20)+"..." : item.text}</Text>
                        <Text style={{fontWeight: 'normal', fontSize:12, color:'#909090'}}>{item.source2}</Text>
                        <Text style={{fontWeight: 'normal', fontSize:12, color: item.open ? '#13a89e' : '#909090'}}>{item.open ? this.state.lg.list.open : item.open === false ? this.state.lg.list.closed : this.state.lg.list.open_na}</Text>
                    </View>
                </View>
            </View>
        </View>);
        return (
            <View style={{
                flex: 1,
                width: sliderItemWidth,
                height: 200,
                paddingHorizontal: sliderItemHorizontalMargin,
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <View style={{
                    width: slideWidth,
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#fff',
                    borderColor: '#dadada',
                    borderWidth: 1,
                    borderRadius: 5
                }}>
                    <TouchableWithoutFeedback onPress={() => {
                        track("Restaurant: Get direction from list to " + item.text);
                        getDirections(item.dir);
                    }}>
                        {content}
                    </TouchableWithoutFeedback>
                </View>
            </View>
        )
    }

    onRenderCarousel() {
        if (!this.state.isCarouselLoaded) {
            return(
                <View>
                    <Image
                        source={require('./img/png/slide_1.png')}
                        style = {{
                            width: width,
                            height: 200,
                            resizeMode: 'stretch',
                            borderColor: '#e0e0e0',
                            borderBottomWidth: 1
                        }} />
                </View>
            );
        } else {
            return(
                <View style={styles.carousel}>
                    <SwipeableParallaxCarousel
                        data={carouselImages}
                        navigation={true}
                        navigationColor={'#fff'}
                        navigationType={'dots'}
                        parallax={true}
                        onPress={(item) => {
                            switch(item) {
                                case 0:
                                    track('Menu: Mosque');
                                    navigate('Masjid')
                                    break;
                                case 1:
                                    track('Menu: Trip');
                                    navigate('Trip')
                                    break;
                                case 2:
                                    track("Menu: Prayer");
                                    navigate('Sholat');
                                    break;
                            }
                        }} />
                </View>
            );
        }
    }

    updateLang(id) {
        Expo.FileSystem.writeAsStringAsync(Expo.FileSystem.documentDirectory + "HalalLocal/settings.txt", JSON.stringify({
            id: id,
            lang: id
        })).then(() => {
        });
        switch (id) {
            case 'en':
                lg = require('./lang/en.json');
                break;
            case 'ar':
                lg = require('./lang/ar.json');
                break;
            case 'id':
                lg = require('./lang/id.json');
                break;
            case 'cn':
                lg = require('./lang/cn.json');
                break;
        }
        this.setState({lang: id, lg: lg});
        lang = id;
        this.setState({lgdone: true});
        this.setState({show: false});
        if (this.state.resto && this.state.resto.length)
            this.textResto(this.state.resto);
    }

    getIntro() {
        return <AppIntro
            dotColor={'rgba(0, 0, 0, 0.1)'}
            activeDotColor={'#13a89e'}
            rightTextColor={'#13a89e'}
            leftTextColor={'#13a89e'}
            doneBtnLabel={'done'}
            // skipBtnLabel={'skip'}
            nextBtnLabel={'next'}
            // onSkipBtnClick={this.onSkipBtnHandle}
            onDoneBtnClick={()=>{this.setState({intro: false}, () => {
                this.forceUpdate();
                setTimeout(()=>{
                    if (this.map && location && location.coords && location.coords.latitude && location.coords.longitude)
                        this.map.fitToElements(false);
                    else {
                        let int2 = setInterval(() => {
                            if (this.map && location && location.coords && location.coords.latitude && location.coords.longitude){
                                clearInterval(int2);
                                this.map.fitToElements(false);
                            }
                        }, 100)
                    }
                },1000)
            })}}
            showSkipButton={false}
            customStyles={{btnContainer: {flex: 1}}}>
            <View>
                <Image
                    style={{
                        height: height,
                        width: width,
                        resizeMode: 'contain'
                    }}
                    source={require('./img/png/intro_1.png')} />
            </View>
            <View>
                <Image
                    style={{
                        height: height,
                        width: width,
                        resizeMode: 'contain'
                    }}
                    source={require('./img/png/intro_2.png')} />
            </View>
            <View>
                <Image
                    style={{
                        height: height,
                        width: width,
                        resizeMode: 'contain'
                    }}
                    source={require('./img/png/intro_3.png')} />
            </View>
            <View>
                <Image
                    style={{
                        height: height,
                        width: width,
                        resizeMode: 'contain'
                    }}
                    source={require('./img/png/intro_4.png')} />
            </View>
        </AppIntro>;
    }

    getIntro2 () {
        return (<View style={{width:'100%', height: 50, backgroundColor: '#13a89e', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
            <View />
            <Image
                source={require('./img/png/img_htitle.png')}
                style={{
                    width: 120,
                    height: 50,
                    alignSelf: 'center',
                    resizeMode: 'contain',
                    marginRight: -60
                }}
            />
            <View style={{marginRight: 20, height: 50, justifyContent: 'center'}}>
                {
                    this.state.lgdone ?
                        <TouchableWithoutFeedback onPress={() => {
                            this.setState({show: true});
                        }}>
                            <View style={{height: '100%', alignItems: 'center', justifyContent: 'center', width: 40}}>
                                <Text style={{color:'white'}}>{this.state.lang.toUpperCase()} ▾</Text>
                            </View>
                        </TouchableWithoutFeedback> :
                        <Loading color="white" size={25}/>
                }
            </View>
        </View>)
    }

    _sendMailAsync = async () => {
        try {
            const { status } = await MailComposer.composeAsync({
                subject: 'Feedback for Halal Local',
                body: 'Hi! I\'ve got a feedback for you!<br/>My ID is: <b>'+id+'</b><br/><br/>',
                recipients: ['info@halallocal.com'],
                isHtml: true,
            });
            if (status === 'sent') {
                Alert.alert(lg.menu.feedbackthanks);
            } else {
                track('Email: Error with status '+status);
            }
        } catch (e) {
            track('Email: Error with error '+e.message);
        }
    };

    render() {
        navigate = this.props.navigation.navigate;
        let restolist = <View style={styles.listFeatures}>
            <View style={styles.titleList}>
                <Text style={styles.titleText}>{this.state.lg.menu.resto}</Text>
                <View style={styles.SubText}>
                    <View style={styles.buttonSubText}>
                        <Text style={styles.Text}>{this.state.lg.list.more + ' >>'}</Text>
                    </View>
                </View>
            </View>
            {
                (this.state.resto && this.state.resto.length ?
                        (<Carousel
                            data={this.state.resto}
                            renderItem={this.renderListComponent}
                            sliderWidth={sliderWidth}
                            itemWidth={sliderItemWidth}
                            activeSlideAlignment={'start'}
                            enableSnap={false}
                            inactiveSlideOpacity={1}
                            inactiveSlideScale={1}
                        />) :
                        (<View style={styles.carouselResto}>
                            {
                                (this.state.resto == -1 ?
                                    (<View style={{flex:1, alignItems: 'center', justifyContent: 'center'}}>
                                        <Image source={require('./img/nolocation.png')} style={{width: 40, height: 40, resizeMode: 'contain'}} />
                                        <Text>{this.state.lg.alert.nolocation}</Text>
                                    </View>) :
                                    (this.state.resto == -2 ?
                                        (<View style={{flex:1, alignItems: 'center', justifyContent: 'center'}}>
                                            <Image source={require('./img/nowifi.png')} style={{width: 40, height: 40, resizeMode: 'contain'}} />
                                            <Text>{this.state.lg.alert.nointernet}</Text>
                                        </View>) :
                                        (this.state.resto == -3 ?
                                            (<View style={{flex:1, alignItems: 'center', justifyContent: 'center'}}>
                                                <Image source={require('./img/noresto.png')} style={{width: 40, height: 40, resizeMode: 'contain'}} />
                                                <Text>{this.state.lg.alert.noresto}</Text>
                                            </View>) :
                                            (<Loading/>))))
                            }
                        </View>)
                )
            }
        </View>;

        return (
            <View style={{backgroundColor: "#E9E9EF"}}>
                {
                    (Platform.OS !== 'android' ?
                        <View style={{alignItems: 'center', justifyContent: 'center', backgroundColor: '#13a89e'}}>
                            <View style={{paddingTop: 20,
                                backgroundColor: '#13a89e'}}>
                            </View>
                            {
                                (!this.state.intro ?
                                    this.getIntro2() : <View/>)
                            }
                        </View>
                        :
                        <View style={{alignItems: 'center', justifyContent: 'center'}}>
                            {this.getIntro2()}
                        </View>)
                }

                <ScrollView style={{marginBottom: 35}}>

                    { this.onRenderCarousel() }

                    <View style={styles.container}>
                        {/*list icon feature*/}
                        <View style={{paddingBottom: 10}}>

                            <View style={styles.containerFeatures}>
                                <TouchableWithoutFeedback
                                    onPress={() => {
                                        if (menuopen) {
                                            menuopen = false;
                                            track("Menu: Restaurant");
                                            navigate('Resto')
                                        }
                                    }}

                                >
                                    <View style={styles.buttonFeature}>
                                        <Image style={{ width: 40, height: 40 }}
                                               source={require('./img/png/ic_resto.png')}/>
                                        <Text style={styles.textFeature}>{this.state.lg.menu.resto}</Text>
                                    </View>
                                </TouchableWithoutFeedback>
                                <TouchableWithoutFeedback
                                    onPress={() => {
                                        if (menuopen) {
                                            menuopen = false;
                                            track("Menu: Mosque");
                                            navigate('Masjid')
                                        }
                                    }}
                                >
                                    <View style={styles.buttonFeature}>
                                        <Image style={{ width: 40, height: 40 }}
                                               source={require('./img/png/ic_masjid.png')}/>
                                        <Text style={styles.textFeature}>{this.state.lg.menu.prayerspace}</Text>
                                    </View>
                                </TouchableWithoutFeedback>
                                <TouchableWithoutFeedback
                                    onPress={() => {
                                        if (menuopen) {
                                            menuopen = false;
                                            track("Menu: Prayer");
                                            navigate('Sholat')
                                        }
                                    }}
                                >
                                    <View style={styles.buttonFeature}>
                                        <Image style={{ width: 40, height: 40 }}
                                               source={require('./img/png/ic_jadwal.png')}/>
                                        <Text style={styles.textFeature}>{this.state.lg.menu.prayertime}</Text>
                                    </View>
                                </TouchableWithoutFeedback>
                            </View>

                            <View style={styles.containerFeatures}>
                                <TouchableWithoutFeedback
                                    onPress={() => {
                                        if (menuopen) {
                                            menuopen = false;
                                            track("Menu: Trip");
                                            navigate('Trip');
                                        }
                                    }}
                                >
                                    <View style={styles.buttonFeature}>
                                        <Image style={{ width: 40, height: 40 }}
                                               source={require('./img/png/ic_trip.png')}/>
                                        <Text style={styles.textFeature}>{this.state.lg.menu.trip}</Text>
                                    </View>
                                </TouchableWithoutFeedback>
                                <TouchableWithoutFeedback
                                    onPress={() => {
                                        if (menuopen) {
                                            menuopen = false;
                                            track("Menu: Qiblat");
                                            navigate('Qiblat')
                                        }
                                    }}
                                >
                                    <View style={styles.buttonFeature}>
                                        <Image style={{ width: 40, height: 40 }}
                                               source={require('./img/png/ic_kiblat.png')}/>
                                        <Text style={styles.textFeature}>{this.state.lg.menu.qibla}</Text>
                                    </View>
                                </TouchableWithoutFeedback>
                                <TouchableWithoutFeedback
                                    onPress={() => {
                                        if (menuopen) {
                                            menuopen = false;
                                            track("Menu: Info");
                                            navigate('Info');
                                        }
                                    }}
                                >
                                    <View style={styles.buttonFeature}>
                                        <Image style={{ width: 40, height: 40 }}
                                               source={require('./img/png/ic_info.png')}/>
                                        <Text style={styles.textFeature}>{this.state.lg.menu.info}</Text>
                                    </View>
                                </TouchableWithoutFeedback>
                            </View>

                        </View>

                        {/* Widget Sholat */}
                        <ImageBackground
                            style={styles.widget}
                            source={require('./img/widget_shalat.jpeg')}>
                            <View style={{flex:1, height:80, width: "100%", alignItems: 'center', justifyContent: 'center'}}>
                                {
                                    (this.state.prayer && typeof this.state.mosque == 'object' && this.state.prayer.now && this.state.prayer.now.length ?
                                        (<View style={{flex:1,alignItems: 'center', justifyContent: 'space-between'}}>
                                            <View style={{flex: 1, flexDirection: "row", paddingBottom: 30}}>
                                                <View style={styles.alignPrayer}>
                                                    <Text style={styles.titlePrayer}>{this.state.lg.prayer[this.state.prayer.now[0]]}</Text>
                                                    <Text style={{color:'white'}}>{this.state.prayer.now[1]}</Text>
                                                </View>
                                                <View style={styles.alignPrayer}>
                                                    <Text style={styles.titlePrayer}>{this.state.lg.prayer.now}</Text>
                                                    <Text style={{color:'white', fontSize: 20}}>{this.state.now}</Text>
                                                </View>
                                                <View style={styles.alignPrayer}>
                                                    <Text style={styles.titlePrayer}>{this.state.lg.prayer[this.state.prayer.next[0]]}</Text>
                                                    <Text style={{ color:'white'}}>{this.state.prayer.next[1]}</Text>
                                                </View>
                                            </View>
                                            <View style={styles.alignPrayer}>
                                                <Text style={{ color:'white'}}>{this.state.prayer.diff[0]} {this.state.lg.prayer.hour} {this.state.prayer.diff[1]} {this.state.lg.prayer.minute} {this.state.lg.prayer.until} {this.state.lg.prayer[this.state.prayer.next[0]]}</Text>
                                            </View>
                                        </View>) :
                                        (this.state.prayer == -1 ?
                                            (<View style={{flex:1, alignItems: 'center', justifyContent: 'center'}}>
                                                <Image source={require('./img/nolocation-white.png')} style={{width: 40, height: 40, resizeMode: 'contain'}} />
                                                <Text style={{color: "white"}}>{this.state.lg.alert.nolocation}</Text>
                                            </View>) :
                                            (this.state.prayer == -2 ?
                                                (<View style={{flex:1, alignItems: 'center', justifyContent: 'center'}}>
                                                    <Image source={require('./img/nowifi-white.png')} style={{width: 40, height: 40, resizeMode: 'contain'}} />
                                                    <Text style={{color: "white"}}>{this.state.lg.alert.nointernet}</Text>
                                                </View>)
                                                :
                                                (<Loading color="white"/>))))
                                }
                            </View>
                        </ImageBackground>
                        <TouchableWithoutFeedback
                            onPress={() => {
                                if (menuopen) {
                                    menuopen = false;
                                    track("Menu: Restaurant");
                                    navigate('Resto')
                                }
                            }}>
                            {restolist}
                        </TouchableWithoutFeedback>
                        <TouchableWithoutFeedback
                            onPress={() => {
                                if (menuopen) {
                                    menuopen = false;
                                    track("Menu: Mosque");
                                    navigate('Masjid')
                                }
                            }}>
                            <View style={styles.listFeatures}>
                                <View style={styles.titleList}>
                                    <Text style={styles.titleText}>{this.state.lg.menu.prayerspace}</Text>
                                    <View style={styles.SubText}>
                                        <View style={styles.buttonSubText}>
                                            <Text style={styles.Text}>{this.state.lg.list.more + ' >>'}</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        </TouchableWithoutFeedback>
                        <View style={{flex:1, height: 150, width: "100%", marginTop:-10,backgroundColor:"#FFF",paddingBottom: 10}}>
                            {
                                (this.state.mosque && typeof this.state.mosque == 'object' && location.coords.latitude?
                                    (<View style={{flex:1}}>
                                        <MapView
                                            provider="google"
                                            loadingEnabled={true}
                                            moveOnMarkerPress={false}
                                            // rotateEnabled={false}
                                            scrollEnabled={false}
                                            cacheEnabled={true}
                                            style={{flex:1}}
                                            ref={map => {this.map = map}}
                                            initialRegion={{
                                                latitude: location.coords.latitude,
                                                longitude: location.coords.longitude,
                                                latitudeDelta: 0.0922,
                                                longitudeDelta: 0.033,
                                            }}
                                        >
                                            <MapView.Marker
                                                ref={loc => this.loc = loc}
                                                key="loc"
                                                coordinate={location.coords}
                                                title="Current location"
                                                image={require('./img/png/img_mcurrent.png')}
                                            />
                                            <MapView.Marker
                                                key={this.state.mosque.key}
                                                coordinate={this.state.mosque.coordinate}
                                                title={this.state.mosque.text}
                                                description={"Source: "+this.state.mosque.source}
                                                image={require('./img/png/img_mmosque.png')}
                                            >
                                            </MapView.Marker>
                                        </MapView>
                                        <TouchableWithoutFeedback
                                            onPress={() => {
                                                track("Get direction");
                                                getDirections(this.state.mosque.dir);
                                            }}>
                                            <View style={{position:'absolute', flexDirection:'row', height: 25,
                                                justifyContent: 'space-between', alignItems:'center', width:'100%', backgroundColor:'black',
                                                opacity: 0.8, marginTop: 115, paddingHorizontal: 5, borderRadius: 5}}>
                                                <Text style={{color: 'white'}}>
                                                    {this.state.lg.list.nearestprayerspace}:
                                                    <Text style={{fontWeight: "bold"}}> {this.state.mosque.text.length > 20 ? this.state.mosque.text.slice(0,20) + "..." : this.state.mosque.text}</Text>
                                                    {" (~"+Math.round(this.state.mosque.distance/100)/10 + this.state.lg.list.km + ")"}
                                                </Text>
                                                <Image source={require('./img/direction-white.png')} style={{width: 24, height: 24, resizeMode: 'contain', marginRight: 5}} />
                                            </View>
                                        </TouchableWithoutFeedback>
                                    </View>) :
                                    (this.state.mosque == -1 ?
                                        (<View style={{flex:1, alignItems: 'center', justifyContent: 'center'}}>
                                            <Image source={require('./img/nolocation.png')} style={{width: 40, height: 40, resizeMode: 'contain'}} />
                                            <Text>{this.state.lg.alert.nolocation}</Text>
                                        </View>) :
                                        (this.state.mosque == -2 ?
                                            (<View style={{flex:1, alignItems: 'center', justifyContent: 'center'}}>
                                                <Image source={require('./img/nowifi.png')} style={{width: 40, height: 40, resizeMode: 'contain'}} />
                                                <Text>{this.state.lg.alert.nointernet}</Text>
                                            </View>) :
                                            (this.state.mosque == -3 ?
                                                (<View style={{flex:1, alignItems: 'center', justifyContent: 'center'}}>
                                                    <Image source={require('./img/nomosque.png')} style={{width: 40, height: 40, resizeMode: 'contain'}} />
                                                    <Text>{this.state.lg.alert.noprayerspace}</Text>
                                                </View>) :
                                                (<Loading/>)))))
                            }
                        </View>

                        <TouchableWithoutFeedback
                            onPress={() => {
                                if (menuopen) {
                                    menuopen = false;
                                    track("Menu: Feed");
                                    navigate('Feed');
                                }
                            }}>
                            <View style={{marginTop: 10, backgroundColor: '#13a89e', height: 50, paddingHorizontal: 10, borderRadius: 5,
                                justifyContent: 'center', alignItems: 'center', marginHorizontal: 20}}>
                                <Text style={{color: 'white', fontWeight: 'bold', fontSize: 14}}>{this.state.lg.menu.feedback}</Text>
                                <Text style={{color: 'white'}}>{this.state.lg.menu.feedbacksub}</Text>
                            </View>
                        </TouchableWithoutFeedback>
                        <View style={{height:45}}/>
                    </View>
                </ScrollView>
                {this.state.show ?
                    <View style={{position: 'absolute',
                        top: 0,
                        right: 0,
                        bottom: 0,
                        left: 0,
                        flex: 1,alignItems: 'center',
                        justifyContent: 'center'}}>
                        <View style={{position: 'absolute',
                            top: 0,
                            right: 0,
                            bottom: 0,
                            left: 0,
                            opacity: 0.7,
                            flex: 1,
                            backgroundColor: 'black'}}>
                            <TouchableWithoutFeedback style={{flex:1}} onPress={()=>{this.setState({show: false})}}>
                                <View style={{
                                    flex: 1,
                                    alignItems: 'center',
                                    justifyContent: 'center'}}>
                                    <View style={{width: "80%", backgroundColor: "white", opacity: 1, borderRadius: 10,
                                        justifyContent: 'center'}}>

                                    </View>
                                </View>
                            </TouchableWithoutFeedback>
                        </View>
                        <View style={{width: "80%", height:200, marginTop: 10}}>
                            <View style={{
                                flex: 1,
                                alignItems: 'center',
                                justifyContent: 'center'}}>
                                <View style={{width: "100%", backgroundColor: "white", opacity: 1, borderRadius: 10,
                                    justifyContent: 'center'}}>
                                    <View style={{margin: 10}}>
                                        <TouchableWithoutFeedback onPress={()=>{this.updateLang("en");}}>
                                            <View style={{flexDirection: 'row', marginVertical: 10, alignItems: 'center'}}>
                                                <Image source={require('./img/png/en2.png')} style={{width: 32, height: 24, marginRight: 10, resizeMode: 'cover'}}/>
                                                <Text>English</Text>
                                            </View>
                                        </TouchableWithoutFeedback>
                                        <View style={{borderWidth:0.5, borderColor: "lightgrey"}} />
                                        <TouchableWithoutFeedback onPress={()=>{this.updateLang("id");}}>
                                            <View style={{flexDirection: 'row', marginVertical: 10, alignItems: 'center'}}>
                                                <Image source={require('./img/png/id2.png')} style={{width: 32, height: 24, marginRight: 10, resizeMode: 'cover'}}/>
                                                <Text>Bahasa</Text>
                                            </View>
                                        </TouchableWithoutFeedback>
                                        <View style={{borderWidth:0.5, borderColor: "lightgrey"}} />
                                        <TouchableWithoutFeedback onPress={()=>{this.updateLang("ar");}}>
                                            <View style={{flexDirection: 'row', marginVertical: 10, alignItems: 'center'}}>
                                                <Image source={require('./img/png/ar2.png')} style={{width: 32, height: 24, marginRight: 10, resizeMode: 'cover'}}/>
                                                <Text>العربية</Text>
                                            </View>
                                        </TouchableWithoutFeedback>
                                        <View style={{borderWidth:0.5, borderColor: "lightgrey"}} />
                                        <TouchableWithoutFeedback onPress={()=>{this.updateLang("cn");}}>
                                            <View style={{flexDirection: 'row', marginVertical: 10, alignItems: 'center'}}>
                                                <Image source={require('./img/png/cn2.png')} style={{width: 32, height: 24, marginRight: 10, resizeMode: 'cover'}}/>
                                                <Text>中文</Text>
                                            </View>
                                        </TouchableWithoutFeedback>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>
                    : <View/>}
                {this.state.intro ?
                    <View style={{position: 'absolute',
                        top: -StatusBar.currentHeight,
                        right: 0,
                        bottom: 0,
                        left: 0,
                        flex: 1,alignItems: 'center',
                        justifyContent: 'center', backgroundColor:"white"}}>
                        {this.getIntro()}
                    </View>
                    : <View/> }
            </View>
        );
    }
}

// RESTO LIST COMPONENT
class Row extends React.PureComponent {
    render () {
        return <View style={styles.listRestoBox}>
            <TouchableWithoutFeedback onPress={() => {
                track("Restaurant: Get direction from list to " + this.props.item.text);
                getDirections(this.props.item.dir);
            }}>
                <View style={styles.insideRestoBox}>
                    <View style={{alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        width: 100, height: 80, borderRadius: 5}}>
                        <Image style={{width: 100, height: 80, borderRadius: 5, resizeMode: this.props.item.photo != restodef ? 'cover' : 'contain'}}
                               source={this.props.item.photo == restodef ? require('./img/png/ic_resto.png') : {uri: this.props.item.photo}} />
                    </View>
                    <View style={{paddingLeft: 10,justifyContent:'center'}}>
                        <Text style={{fontWeight: "bold", fontSize: 14, color: "#686868"}}>{this.props.item.text}</Text>
                        <Text style={{fontSize: 12, color: "#909090"}}>{lg.list.distance+": ~"+Math.round(this.props.item.distance/100)/10 + lg.list.km}</Text>
                        <Text style={{fontSize: 12, color: "#909090"}}>{lg.list.source}: {this.props.item.source}</Text>
                        <Text style={{fontWeight: 'normal', fontSize:12, color: this.props.item.open ? '#13a89e' : '#909090'}}>{this.props.item.open ? lg.list.open : this.props.item.open === false ? lg.list.closed : lg.list.open_na}</Text>
                    </View>
                </View>
            </TouchableWithoutFeedback>
        </View>
    }
}

// PRAYER TIME COMPONENT
class Row2 extends React.PureComponent {
    render () {
        // Check if the current item list matches with current date for formatting
        let match = new Date().getDate() == this.props.tgl && new Date().getMonth()+1 == prayer.time.month && new Date().getFullYear() == prayer.time.year;
        return (
            <View style={{paddingVertical: 10, paddingLeft: 10, borderBottomColor: '#dadada',borderBottomWidth: 1,
                backgroundColor: match ? "#13a89e" : this.props.tgl % 2 == 0 ? "rgba(19,168,158, 0.2)" : "white"}}>
                <View style={{flexDirection:"row", alignItems: 'center', justifyContent:'center'}}>
                    <Text style={{flex:10, color: match ? "#F7F9F4" : "#10120D", textAlign: 'center'}}>{this.props.tgl}</Text>
                    <Text style={{flex:15, color: match ? "#F7F9F4" : "#10120D", textAlign: 'center'}}>{this.props.sbh.replace(' ','\n')}</Text>
                    <Text style={{flex:15, color: match ? "#F7F9F4" : "#10120D", textAlign: 'center'}}>{this.props.dhr.replace(' ','\n')}</Text>
                    <Text style={{flex:15, color: match ? "#F7F9F4" : "#10120D", textAlign: 'center'}}>{this.props.asr.replace(' ','\n')}</Text>
                    <Text style={{flex:15, color: match ? "#F7F9F4" : "#10120D", textAlign: 'center'}}>{this.props.mgr.replace(' ','\n')}</Text>
                    <Text style={{flex:15, color: match ? "#F7F9F4" : "#10120D", textAlign: 'center'}}>{this.props.isy.replace(' ','\n')}</Text>
                </View>
            </View>
        )
    }
}

let locationWatcher = null;

// QIBLA COMPASS
class Compass extends React.Component {
    constructor() {
        super();
        this.state = { heading: new Animated.Value(0), accuracy: 0 };

        this.onRotateDebounced = debounce(this.onRotate, 100);
    }

    onRotate(heading) {
        Animated.timing(this.state.heading, {
            toValue: 360 - heading + this.props.degree,
            duration: 170,
        }).start();
    }

    componentWillMount() {
        if (!locationWatcher) {
            track("Qiblat: " + this.props.degree + "°")
            locationWatcher = Location.watchHeadingAsync(({ magHeading, trueHeading, accuracy }) => {
                this.onRotateDebounced(trueHeading || magHeading);
            });
        }
    }

    render() {
        let rotationAmount = this.state.heading.interpolate({
            inputRange: [0, 360],
            outputRange: ['0deg', '360deg'],
        });
        return(<Animated.View
            style={{transform: [{ rotate: rotationAmount }]}}>
            <Image style={{ width: 200, height: 200 }}
                   source={require('./img/png/img_compass.png')}/>
        </Animated.View>);
    }
}

// TRIP
class Trip extends React.Component {
    static navigationOptions = {
        headerTitle:
            <Image
                source={require('./img/png/img_htitle.png')}
                style={{
                    width: 110,
                    height: 40,
                    alignSelf: 'center',
                    resizeMode: 'contain'
                }} />,
        headerStyle: {
            backgroundColor: '#13a89e',
        },
        headerTintColor: '#fff',
        headerRight:
            <TouchableWithoutFeedback
                onPress={() => Linking.openURL(trip_url)}>
                <View>
                    <Image
                        source={require('./img/png/ic_web.png')}
                        style={{
                            width: 24,
                            height: 24,
                            alignSelf: 'center',
                            resizeMode: 'contain',
                            margin: 20
                        }} />
                </View>
            </TouchableWithoutFeedback>
    };

    constructor(props) {
        super(props);
        this.state = {done: 0}
    }

    async componentWillMount(){
        await fetch(trip_url).then(()=>{
            this.setState({done: 1});
        }).catch(err => {track("!! Trip => check website: " + err.message); this.setState({done: -1});});
    }

    componentWillUnmount() {
        menuopen = true;
    }

    render() {
        return (

            (this.state.done == 1 ?
                <WebView
                    source={{uri: trip_url}}
                /> : (this.state.done == -1 ? <View style={{backgroundColor:'#E9E9EF', flex:1, alignItems:'center', justifyContent:'center'}}>
                    <Image source={require('./img/nowifi.png')} style={{width: 40, height: 40, resizeMode: 'contain'}} />
                    <Text>{lg.alert.nointernet}</Text>
                </View> :
                    <View style={{backgroundColor:'#E9E9EF', flex:1, alignItems:'center', justifyContent:'center'}}>
                        <Loading />
                    </View>))
        );
    }
}

// MASJID
class Masjid extends React.Component {
    static navigationOptions = {
        headerTitle:
            <Image
                source={require('./img/png/img_htitle.png')}
                style={{
                    width: 110,
                    height: 40,
                    alignSelf: 'center',
                    resizeMode: 'contain'
                }} />,
        headerStyle: {
            backgroundColor: '#13a89e',
        },
        headerTintColor: '#fff',
        headerRight:
            <View/>
    };

    constructor(props) {
        super(props);
        this.state = {
            markers: [], done: [false, false]
        }
    }

    // Temporary query, used to revert the query on autocomplete search box when there is no connection during updateSchedule()
    qT = query ? Object.assign({}, query) : null;

    int = [0,0,0];

    mount = true;

    tog = true;

    componentDidMount() {
        this.place.setAddressText(query ? query.q : "Current location");
        this.place._onBlur();

        // If autocomplete search box is not empty, then set variable temporary query with it
        this.qT = query ? Object.assign({}, query) : null;

        this.checkInternet();
    }

    componentWillUnmount() {
        this.clearInt();
        this.mount = false;
        menuopen = true;
    }

    clearInt(){
        for (let i in this.int)
            clearInterval(this.int[i]);
        if (this.mount)
            this.setState({done: [false, false],notif: null,loc: query});
        // this.setState({done: [false, false]});
        // this.setState({notif: null});
        // this.setState({loc: query});
    }

    // Recheck for location permission whether there is a change
    async checkPermission() {
        // Check if the permission of location is not granted since Home screen (var mosque.markers == -1)
        let {status} = await Permissions.askAsync(Permissions.LOCATION);
        // If the permission finally granted, get nearby prayer spaces
        if (status == "granted") {
            // Get current location
            location = await Location.getCurrentPositionAsync({enableHighAccuracy:true});

            // If there is no query assigned, set with default one (current location)
            if (query == null)
                query = {lat: location.coords.latitude, lng: location.coords.longitude, q: "Current location"};
            if (this.mount)
                this.setState({loc: query});
            // Retrieve nearby prayer spaces
            this.updateMarkers([query, {mosque: true, qiblat: true}]);
            // this.checkInternet(true);
        }
        // If the permission still not be granted, throw error message
        else {
            track("!! Mosque: Tidak diberikan permission atas location");
            Alert.alert(lg.alert.nolocation);
            //UBAH KE SNACKBAR
        }
    }

    checkInternet(update, fetching) {
        // Temporary markers, used to revert back when there is no connection during updateMarkers() (the screen is showing last markers instead of empty data)
        let temp = this.state.markers && this.state.markers.length > 0? this.state.markers.slice(0) : [];
        // Refresh the value of this.state.markers and notif
        this.clearInt();
        // If need update, retrieve nearby prayer spaces
        if (update)
            getCountry(query.lat,query.lng).then(ctr => {
                query.ctr = ctr;
                updateMosque(query);
            });

        let temp2 = this.state.markers.length;
        let temp3 = null;
        let temp4 = true;

        this.int[0] = setInterval(()=>{
            if (mosque.done.every(v => v)) {
                clearInterval(this.int[0]);
                if (this.mount)
                    this.setState({notif: null});
            }
            if (!this.state.notif)
                if (this.mount)
                    this.setState({notif: lg.notif.getloc});
            let pos = !this.state.notif ? -1 : this.state.notif.indexOf("...");
            if (pos!=-1) {
                if (this.mount)
                    this.setState({notif: this.state.notif.slice(0, pos)});
            }
            else {
                if (this.mount)
                    this.setState({notif: this.state.notif + "."});
            }
        },300);

        this.int[1] = setInterval(() => {
            if (query != temp3) {
                if (this.mount)
                    this.setState({notif: lg.notif.getkeywordprayerspace, loc: query});
                temp3 = query;
                if (this.mount)
                    this.map.animateToRegion(
                        {
                            latitude: query.lat,
                            longitude: query.lng,
                            latitudeDelta: 0.0922,
                            longitudeDelta: 0.033,
                        }, 500
                    );
            }

            if (mosque.markers == -1 && !update) {
                clearInterval(this.int[1]);
                clearInterval(this.int[0]);
                if (this.mount)
                    this.setState({notif: null,markers: mosque.markers});
                this.checkPermission();
            }
            else if (mosque.markers == -2) {
                if (!update) {
                    clearInterval(this.int[1]);
                    clearInterval(this.int[0]);
                    if (this.mount)
                        this.setState({notif: null,markers: mosque.markers});
                    this.updateMarkers([query, {mosque: true, qiblat: true}]);
                }
                else {
                    clearInterval(this.int[1]);
                    clearInterval(this.int[0]);
                    if (this.mount)
                        this.setState({markers: mosque.markers});
                    // Revert back the markers (instead of showing empty marker)
                    if (temp.length>0)
                        mosque = {markers: temp, done: [true, true]};
                    else
                        mosque = {markers: -2, done: [false, false]};
                    let intt = setInterval(()=>{
                        if (query){
                            clearInterval(intt);
                            query = Object.assign({}, this.qT ? this.qT : query);
                            if (this.mount)
                                this.setState({markers: temp,loc: this.qT ? this.qT : query, notif: null});
                            this.place.setAddressText(this.qT ? this.qT.q : query.q);
                            this.place._handleChangeText(this.qT ? this.qT.q : query.q);
                            this.place._onBlur();
                            if (this.mount)
                                this.map.fitToElements(true);
                        }
                    },10);

                    // Revert back the pickers' selected value to previously
                    Alert.alert(lg.alert.nointernet);
                    //UBAH KE SNACKBAR
                }
            } else if (temp2 != mosque.markers.length || mosque.done.every(v => v)) {
                if (this.mount)
                    this.setState({markers: mosque.markers});
                if (mosque.done.every(v => v)) {
                    clearInterval(this.int[1]);
                    clearInterval(this.int[0]);
                    this.loc ? this.loc.showCallout() : null;
                    if (this.mount)
                        this.setState({notif: lg.notif.finishprayerspace.replace(/{length}/g,mosque.markers.length)});
                    setTimeout(() => {
                        if (this.mount)
                            this.setState({notif: null});
                    }, 2000);
                    // Fetch other features' data as well
                }
                else if (mosque.done[0]){
                    if (this.mount)
                        this.setState({notif: lg.notif.getpointprayerspace});
                }
                else if (mosque.done[1]){
                    if (this.mount)
                        this.setState({notif: lg.notif.getkeywordprayerspace});
                }
                temp2 = mosque.markers.length;
                if (this.mount)
                    this.map.fitToElements(true);
                this.qT = Object.assign({}, query);
                if (fetching && temp4) {
                    temp4 = false;
                    fetchData(fetching[0], fetching[1]);
                }
            }
        }, 100);
        // }
    }

    // Get new prayer time
    updateMarkers(fetching){
        // If the query is not Current location or Current location but location permission is granted
        if (this.state.markers != -1 || (query != null && query.lat != 0 && query.q != "Current location")) {
            // Wait for previous query assignment to be finished (from Home screen)
            this.int[2] = setInterval(() => {
                // If the var query is assigned
                if (query) {
                    // Clear the interval
                    clearInterval(this.int[2]);
                    // Retrieve the prayer time
                    mosque={markers: [], done: [false, false]};
                    this.checkInternet(true, fetching);
                }
            }, 100);
        }
        else
        // If the location permission is not granted
            Alert.alert(lg.alert.nolocation);
        //UBAH KE SNACKBAR
    }

    render() {
        return (
            <View style={{flex:1, backgroundColor: "#E9E9EF"}}>
                <View style={{flex:1}}>
                    <GooglePlacesAutocomplete
                        ref={place => this.place = place}
                        placeholder='Search'
                        minLength={3}
                        autoFocus={false}
                        returnKeyType={'search'}
                        listViewDisplayed='false'
                        fetchDetails={true}
                        onPress={(data, details = null) => {
                            this.loc ? this.loc.hideCallout() : null;
                            this.clearInt();
                            query = {lat: details.geometry ? details.geometry.location.lat : 0, lng: details.geometry ? details.geometry.location.lng : 0, q: data.description};
                            if (this.mount)
                                this.setState({loc: query,show: null});
                            // Retrieve for new prayer time
                            this.updateMarkers([query, {mosque: true, qiblat: true}]);
                            track("Mosque: Query for " + data.description);
                        }}
                        query={{
                            key: keyMap,
                        }}
                        currentLocation={true} // Will add a 'Current location' button at the top of the predefined places list
                        nearbyPlacesAPI='None'
                        textInputProps={{ selectTextOnFocus: true, onBlur: () => {
                            this.place._onBlur();
                            if(this.place.getAddressText() == ""){
                                this.place.setAddressText(this.qT);
                                this.place._handleChangeText(this.qT);
                            }
                        }, onEndEditing: () => {
                            this.place._onBlur();
                            if(this.place.getAddressText() == ""){
                                this.place.setAddressText(this.qT);
                                this.place._handleChangeText(this.qT);
                            }
                        }}}
                        styles = {{
                            textInputContainer: {
                                backgroundColor: '#f5f5f5'
                            },
                            textInput: {
                                backgroundColor: '#fff',
                                borderRadius: 4,
                                // marginLeft: 0,
                                // marginRight: 0,
                                // height: 38,
                                // color: '#5d5d5d',
                                // fontSize: 16
                            }
                        }}
                        renderRightButton={() =>
                            <TouchableWithoutFeedback
                                onPress = {() => {
                                    track("Mosque: Clear query");
                                    this.place.setAddressText("");
                                    this.place._handleChangeText("");
                                    this.place.triggerFocus()}}>
                                <View
                                    style = {{
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        marginTop: 8,
                                        marginRight: 8,
                                        // marginLeft: 8
                                    }}>
                                    <Image
                                        source={require('./img/png/ic_delete.png')}
                                        style={{
                                            width: 30,
                                            height: 30,
                                            alignSelf: 'center',
                                            resizeMode: 'contain'
                                        }} />
                                </View>
                            </TouchableWithoutFeedback>
                        }
                        enablePoweredByContainer={false}>
                        <MapView
                            loadingEnabled={true}
                            style={{flex:1}}
                            ref={map => {this.map = map}}
                            initialRegion={{
                                latitude: query && query.lat ? query.lat : -6.904391,
                                longitude: query && query.lng ? query.lng : 107.616946,
                                latitudeDelta: 0.0922,
                                longitudeDelta: 0.033,
                            }}
                            onPress={()=> {
                                if (this.tog)
                                    if (this.mount)
                                        this.setState({show: null});
                            }}
                            provider="google"
                        >
                            { (this.state.loc && this.state.loc.lat) ?
                                (<MapView.Marker
                                    ref={loc => this.loc = loc}
                                    key="loc"
                                    coordinate={{latitude: this.state.loc.lat, longitude: this.state.loc.lng}}
                                    title={this.state.loc.q}
                                    image={require('./img/png/img_mcurrent.png')}
                                />) : (<View/>)
                            }

                            {this.state.markers && this.state.markers.length>1 ? this.state.markers.map(marker => (
                                <MapView.Marker
                                    key={marker.key}
                                    coordinate={marker.coordinate}
                                    onPress={()=>{
                                        this.tog = false
                                        if (this.mount)
                                            this.setState({show: marker.key});
                                        setTimeout(()=>{this.tog = true},100);
                                    }}
                                    title={marker.text}
                                    description={lg.list.source+": "+marker.source}
                                    image={require('./img/png/img_mmosque.png')}
                                >
                                </MapView.Marker>
                            )):<View/>}

                        </MapView>
                    </GooglePlacesAutocomplete>
                </View>
                {
                    this.state.show != null ?
                        (<View style={{
                            position: "absolute",
                            bottom: 0,
                            width: '100%',
                            flex: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                            alignSelf: 'center',
                        }}>
                            <View style={{
                                // position: "absolute",
                                padding: 10,
                                margin: 10,
                                height: 100,
                                flex: 1,
                                backgroundColor: "white",
                                flexDirection: "row",
                                alignSelf: 'center',
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: '#dadada',
                            }}>
                                <View style={{alignItems: 'center',
                                    justifyContent: 'center',
                                    overflow: 'hidden',
                                    width: 100, height: 80, borderRadius: 5}}>
                                    <Image style={{width: 100, height: 80, borderRadius: 5, resizeMode: this.state.markers[this.state.show].photo != mosquedef ? 'cover' : 'contain'}}
                                           source={this.state.markers[this.state.show].photo == mosquedef ? require('./img/png/ic_masjid.png') : {uri: this.state.markers[this.state.show].photo}} />
                                </View>
                                <View style={{marginLeft: 10, flexDirection: 'column', flex: 1}}>
                                    <Text style={{fontWeight: "bold", fontSize: 14, color: "#686868"}}>{this.state.markers[this.state.show].text}</Text>
                                    <Text style={{fontSize: 12, color: "#909090"}}>{lg.list.distance+": ~"+Math.round(this.state.markers[this.state.show].distance/100)/10 + lg.list.km}</Text>
                                    <Text style={{fontSize: 12, color: "#909090"}}>{lg.list.source}: {this.state.markers[this.state.show].source}</Text>
                                </View>
                                <View style={{justifyContent: 'space-around'}}>
                                    <View style={{flex:1, alignItems: 'flex-end', justifyContent: 'flex-start'}}>
                                        <TouchableWithoutFeedback onPress={() => {
                                            if (this.mount)
                                                this.setState({show: null})}}>
                                            <Image source={require('./img/close.png')} style={{width: 24, height: 24, resizeMode: 'contain'}} />
                                        </TouchableWithoutFeedback>
                                    </View>
                                    <View style={{flex:1, alignItems: 'flex-end', justifyContent: 'flex-end'}}>
                                        <TouchableWithoutFeedback onPress={() => {
                                            track("Mosque: Get direction from map to " + this.state.markers[this.state.show].text);
                                            getDirections(this.state.markers[this.state.show].dir)}}>
                                            <Image source={require('./img/direction.png')} style={{width: 24, height: 24, resizeMode: 'contain'}} />
                                        </TouchableWithoutFeedback>
                                    </View>
                                </View>
                            </View>
                        </View>) : <View/>}
                {
                    this.state.notif ?
                        (<View style={{
                            position: "absolute",
                            top: 44,
                            width: '100%',
                            flex: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: "#303030"
                        }}>
                            <Text style={{fontWeight: "bold", color: "white"}}>{this.state.notif}</Text>
                        </View>) : <View/>}

            </View>
        );
    }
}

// RESTO LIST
class Resto extends React.Component {
    static navigationOptions = {
        headerTitle:
            <Image
                source={require('./img/png/img_htitle.png')}
                style={{
                    width: 110,
                    height: 40,
                    alignSelf: 'center',
                    resizeMode: 'contain'
                }} />,
        headerStyle: {
            backgroundColor: '#13a89e',
        },
        headerTintColor: '#fff',
        headerRight:
            <TouchableWithoutFeedback
                onPress={() => {
                    if (menuopen2) {
                        menuopen2 = false;
                        navigate('Resto2')
                    }}}>
                <View>
                    <Image
                        source={require('./img/png/ic_route_white.png')}
                        style={{
                            width: 24,
                            height: 24,
                            alignSelf: 'center',
                            resizeMode: 'contain',
                            margin: 20
                        }} />
                </View>
            </TouchableWithoutFeedback>
    };

    constructor(props) {
        super(props);
        this.state = {
            markers: [], done: [false, false]
        }
    }

    // Temporary query, used to revert the query on autocomplete search box when there is no connection during updateSchedule()
    qT = query ? Object.assign({}, query) : null;

    int = [0,0,0];

    mount = true;

    nav;

    componentDidMount() {
        this.place.setAddressText(query ? query.q : "Current location");
        this.place._onBlur();

        // If autocomplete search box is not empty, then set variable temporary query with it
        this.qT = query ? Object.assign({}, query) : null;

        this.checkInternet();
    }

    componentWillUnmount() {
        this.clearInt();
        this.mount = false;
        menuopen = true;
    }

    clearInt(){
        for (let i in this.int)
            clearInterval(this.int[i]);
        if (this.mount)
            this.setState({done: [false, false],notif: null,loc: query});
        // this.setState({done: [false, false]});
        // this.setState({notif: null});
        // this.setState({loc: query});
    }

    // Recheck for location permission whether there is a change
    async checkPermission() {
        // Check if the permission of location is not granted since Home screen (var resto.markers == -1)
        let {status} = await Permissions.askAsync(Permissions.LOCATION);
        // If the permission finally granted, get nearby restaurants
        if (status == "granted") {
            // Get current location
            location = await Location.getCurrentPositionAsync({enableHighAccuracy:true});

            // If there is no query assigned, set with default one (current location)
            if (query == null)
                query = {lat: location.coords.latitude, lng: location.coords.longitude, q: "Current location"};
            if (this.mount)
                this.setState({loc: query});
            // Retrieve nearby restaurants
            this.updateMarkers([query, {resto: true, qiblat: true}]);
            // this.checkInternet(true);
        }
        // If the permission still not be granted, throw error message
        else {
            track("!! Resto: Tidak diberikan permission atas location");
            if (this.state.markers == null || this.state.markers.length == 0)
                Alert.alert(lg.alert.nolocation);
            // UBAH KE SNACKBAR
        }
    }

    checkInternet(update, fetching) {
        // Temporary markers, used to revert back when there is no connection during updateMarkers() (the screen is showing last markers instead of empty data)
        let temp = this.state.markers && this.state.markers.length > 0? this.state.markers.slice(0) : [];
        // Refresh the value of this.state.markers and notif
        this.clearInt();
        // If need update, retrieve nearby restaurants
        if (update)
            getCountry(query.lat,query.lng).then(ctr => {
                query.ctr = ctr;
                updateResto(query);
            });

        let temp2 = this.state.markers.length;
        let temp3 = null;
        let temp4 = true;

        this.int[0] = setInterval(()=>{
            if (resto.done.every(v => v)) {
                clearInterval(this.int[0]);
                if (this.mount)
                    this.setState({notif: null});
            }
            if (!this.state.notif)
                if (this.mount)
                    this.setState({notif: lg.notif.getloc});
            let pos = !this.state.notif ? -1 : this.state.notif.indexOf("...");
            if (pos!=-1) {
                if (this.mount)
                    this.setState({notif: this.state.notif.slice(0, pos)});
            }
            else {
                if (this.mount)
                    this.setState({notif: this.state.notif + "."});
            }
        },300);
        this.int[1] = setInterval(() => {
            if (query != temp3) {
                if (this.mount)
                    this.setState({notif: lg.notif.getkeywordresto,loc: query});
                temp3 = query;
            }
            if (resto.markers == -1 && !update) {
                clearInterval(this.int[1]);
                clearInterval(this.int[0]);
                if (this.mount)
                    this.setState({notif: null,markers: resto.markers});
                this.checkPermission();
            }
            else if (resto.markers == -2) {
                if (!update) {
                    clearInterval(this.int[1]);
                    clearInterval(this.int[0]);
                    if (this.mount)
                        this.setState({notif: null,markers: resto.markers});
                    this.updateMarkers([query, {resto: true, qiblat: true}]);
                }
                else {
                    clearInterval(this.int[1]);
                    clearInterval(this.int[0]);
                    if (this.mount)
                        this.setState({markers: resto.markers});
                    // Revert back the markers (instead of showing empty marker)
                    if (temp.length>0)
                        resto = {markers: temp, done: [true, true]};
                    else
                        resto = {markers: -2, done: [false, false]};
                    let intt = setInterval(()=>{
                        if (query){
                            clearInterval(intt);
                            query = Object.assign({}, this.qT ? this.qT : query);
                            if (this.mount)
                                this.setState({markers: temp.length ? temp : -2,loc: this.qT ? this.qT : query, notif: null});
                            this.place.setAddressText(this.qT ? this.qT.q : query.q);
                            this.place._handleChangeText(this.qT ? this.qT.q : query.q);
                            this.place._onBlur();
                        }
                    },10);

                    // Revert back the pickers' selected value to previously
                    if (temp.length)
                        Alert.alert(lg.alert.nointernet);
                    // UBAH KE SNACKBAR
                }
            } else if (temp2 != resto.markers.length || resto.done.every(v => v)) {
                if (this.mount)
                    this.setState({markers: resto.markers});
                if (resto.done.every(v => v)) {
                    clearInterval(this.int[1]);
                    clearInterval(this.int[0]);
                    if (this.mount)
                        this.setState({notif: lg.notif.finishresto.replace(/{length}/g,resto.markers.length)});
                    setTimeout(() => {
                        if (this.mount)
                            this.setState({notif: null});
                    }, 2000);
                    let artemp = resto.markers.map((n,i)=>[i,n.distance]);
                    artemp.sort((a,b)=>a[1]-b[1]);
                    this.setState({markers: artemp.map(n=>resto.markers[n[0]])});
                    // Fetch other features' data as well
                }
                else if (resto.done[0]){
                    if (this.mount)
                        this.setState({notif: lg.notif.getpointresto});
                }
                else if (resto.done[1]){
                    if (this.mount)
                        this.setState({notif: lg.notif.getkeywordresto});
                }
                temp2 = resto.markers.length;
                this.qT = Object.assign({}, query);
                if (fetching && temp4) {
                    temp4 = false;
                    fetchData(fetching[0], fetching[1]);
                }
            }
        }, 100);
        // }
    }

    // Get new prayer time
    updateMarkers(fetching){
        // If the query is not Current location or Current location but location permission is granted
        if (this.state.markers != -1 || (query != null && query.lat != 0 && query.q != "Current location")) {
            // Wait for previous query assignment to be finished (from Home screen)
            this.int[2] = setInterval(() => {
                // If the var query is assigned
                if (query) {
                    // Clear the interval
                    clearInterval(this.int[2]);
                    // Retrieve the prayer time
                    resto={markers: [], done: [false, false]};
                    this.checkInternet(true, fetching);
                }
            }, 100);
        }
        else
        if (this.state.markers == null || this.state.markers.length == 0)
        // If the location permission is not granted
            Alert.alert(lg.alert.nolocation);
        // UBAH KE SNACKBAR
    }

    render() {
        return (
            <View style={{flex:1, backgroundColor: "#E9E9EF"}}>
                <View style={{flex:1}}>
                    <GooglePlacesAutocomplete
                        ref={place => this.place = place}
                        placeholder='Search'
                        minLength={3}
                        autoFocus={false}
                        returnKeyType={'search'}
                        listViewDisplayed='false'
                        fetchDetails={true}
                        onPress={(data, details = null) => {
                            this.clearInt();
                            query = {lat: details.geometry ? details.geometry.location.lat : 0, lng: details.geometry ? details.geometry.location.lng : 0, q: data.description};
                            if (this.mount)
                                this.setState({loc: query,show: null});
                            // Retrieve for new prayer time
                            this.updateMarkers([query, {resto: true, qiblat: true}]);
                            track("Resto: Query for " + data.description);
                        }}
                        query={{
                            key: keyMap,
                        }}
                        currentLocation={true} // Will add a 'Current location' button at the top of the predefined places list
                        nearbyPlacesAPI='None'
                        textInputProps={{ selectTextOnFocus: true, onBlur: () => {
                            this.place._onBlur();
                            if(this.place.getAddressText() == ""){
                                this.place.setAddressText(this.qT);
                                this.place._handleChangeText(this.qT);
                            }
                        }, onEndEditing: () => {
                            this.place._onBlur();
                            if(this.place.getAddressText() == ""){
                                this.place.setAddressText(this.qT);
                                this.place._handleChangeText(this.qT);
                            }
                        }}}
                        styles = {{
                            textInputContainer: {
                                backgroundColor: '#f5f5f5'
                            },
                            textInput: {
                                backgroundColor: '#fff',
                                borderRadius: 4,
                            }
                        }}
                        renderRightButton={() =>
                            <TouchableWithoutFeedback
                                onPress = {() => {
                                    track("Resto: Clear query");
                                    this.place.setAddressText("");
                                    this.place._handleChangeText("");
                                    this.place.triggerFocus()}}>
                                <View
                                    style = {{
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        marginTop: 8,
                                        marginRight: 8,
                                        // marginLeft: 8
                                    }}>
                                    <Image
                                        source={require('./img/png/ic_delete.png')}
                                        style={{
                                            width: 30,
                                            height: 30,
                                            alignSelf: 'center',
                                            resizeMode: 'contain'
                                        }} />
                                </View>
                            </TouchableWithoutFeedback>
                        }
                        enablePoweredByContainer={false}>

                        {
                            (this.state.markers != null && this.state.markers.length != 0?
                                (this.state.markers == -1 ?
                                    (<View style={{backgroundColor:'#E9E9EF', flex:1, alignItems:'center', justifyContent:'center'}}>
                                        <Image source={require('./img/nolocation.png')} style={{width: 100, height: 100, resizeMode: 'contain'}} />
                                        <Text>{lg.alert.nolocation}</Text>
                                    </View>) :
                                    (this.state.markers == -2 ?
                                        (<View style={{backgroundColor:'#E9E9EF', flex:1, alignItems:'center', justifyContent:'center'}}>
                                            <Image source={require('./img/nowifi.png')} style={{width: 100, height: 100, resizeMode: 'contain'}} />
                                            <Text>{lg.alert.nointernet}</Text>
                                        </View>) :
                                        (this.state.markers.length == 0 && this.state.done.every(t => t) ?
                                            (<View style={{backgroundColor:'#E9E9EF', flex:1, alignItems:'center', justifyContent:'center'}}>
                                                <Image source={require('./img/noresto.png')} style={{width: 100, height: 100, resizeMode: 'contain'}} />
                                                <Text>{lg.alert.noresto}</Text>
                                            </View>) :
                                            (<FlatList
                                                style={{ flex: 1, marginTop: 5 }}
                                                data={this.state.markers}
                                                renderItem={({ item }) => <Row item={item}/>}
                                                updateCellsBatchingPeriod={100}
                                            />)))) :
                                (<Loading />))
                        }
                    </GooglePlacesAutocomplete>
                </View>
                {
                    this.state.notif ?
                        (<View style={{
                            position: "absolute",
                            top: 44,
                            width: '100%',
                            flex: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: "#303030"
                        }}>
                            <Text style={{fontWeight: "bold", color: "white"}}>{this.state.notif}</Text>
                        </View>) : <View/>}

            </View>
        );
    }
}

// RESTO MAP
class Resto2 extends React.Component {
    static navigationOptions = {
        headerTitle:
            <Image
                source={require('./img/png/img_htitle.png')}
                style={{
                    width: 110,
                    height: 40,
                    alignSelf: 'center',
                    resizeMode: 'contain'
                }} />,
        headerStyle: {
            backgroundColor: '#13a89e',
        },
        headerTintColor: '#fff',
        headerRight:
            <View/>
    };

    constructor(props) {
        super(props);
        this.state = {
            markers: [], done: [false, false]
        }
    }

    // Temporary query, used to revert the query on autocomplete search box when there is no connection during updateSchedule()
    qT = query ? Object.assign({}, query) : null;

    int = [0,0,0];

    mount = true;

    tog = true;

    componentWillMount() {

    }

    componentDidMount() {
        // If autocomplete search box is not empty, then set variable temporary query with it
        this.qT = query ? Object.assign({}, query) : null;
        this.checkInternet();
    }

    componentWillUnmount() {
        this.clearInt();
        this.mount = false;
        menuopen2 = true;
    }

    clearInt(){
        for (let i in this.int)
            clearInterval(this.int[i]);
        if (this.mount)
            this.setState({done: [false, false],notif: null,loc: query});
        // this.setState({done: [false, false]});
        // this.setState({notif: null});
        // this.setState({loc: query});
    }

    // Recheck for location permission whether there is a change
    async checkPermission() {
        // Check if the permission of location is not granted since Home screen (var resto.markers == -1)
        let {status} = await Permissions.askAsync(Permissions.LOCATION);
        // If the permission finally granted, get nearby restaurants
        if (status == "granted") {
            // Get current location
            location = await Location.getCurrentPositionAsync({enableHighAccuracy:true});

            // If there is no query assigned, set with default one (current location)
            if (query == null)
                query = {lat: location.coords.latitude, lng: location.coords.longitude, q: "Current location"};
            if (this.mount)
                this.setState({loc: query});
            // Retrieve nearby restaurants
            this.updateMarkers([query, {resto: true, qiblat: true}]);
            // this.checkInternet(true);
        }
        // If the permission still not be granted, throw error message
        else {
            track("!! Resto: Tidak diberikan permission atas location");
            Alert.alert(lg.alert.nolocation);
            // UBAH KE SNACKBAR
        }
    }

    checkInternet(update, fetching) {
        // Temporary markers, used to revert back when there is no connection during updateMarkers() (the screen is showing last markers instead of empty data)
        let temp = this.state.markers && this.state.markers.length > 0? this.state.markers.slice(0) : [];
        // Refresh the value of this.state.markers and notif
        this.clearInt();
        // If need update, retrieve nearby restaurants
        if (update)
            getCountry(query.lat,query.lng).then(ctr => {
                query.ctr = ctr;
                updateResto(query);
            });

        let temp2 = this.state.markers.length;
        let temp3 = null;
        let temp4 = true;

        this.int[0] = setInterval(()=>{
            if (resto.done.every(v => v)) {
                clearInterval(this.int[0]);
                if (this.mount)
                    this.setState({notif: null});
            }
            if (!this.state.notif)
                if (this.mount)
                    this.setState({notif: lg.notif.getloc});
            let pos = !this.state.notif ? -1 : this.state.notif.indexOf("...");
            if (pos!=-1) {
                if (this.mount)
                    this.setState({notif: this.state.notif.slice(0, pos)});
            }
            else {
                if (this.mount)
                    this.setState({notif: this.state.notif + "."});
            }
        },300);
        this.int[1] = setInterval(() => {
            if (query != temp3) {
                if (this.mount)
                    this.setState({notif: lg.notif.getkeywordresto, loc: query});
                temp3 = query;
                if (this.mount)
                    this.map.animateToRegion(
                        {
                            latitude: query.lat,
                            longitude: query.lng,
                            latitudeDelta: 0.0922,
                            longitudeDelta: 0.033,
                        }, 500
                    );
            }
            if (resto.markers == -1 && !update) {
                clearInterval(this.int[1]);
                clearInterval(this.int[0]);
                if (this.mount)
                    this.setState({notif: null,markers: resto.markers});
                this.checkPermission();
            }
            else if (resto.markers == -2) {
                if (!update) {
                    clearInterval(this.int[1]);
                    clearInterval(this.int[0]);
                    if (this.mount)
                        this.setState({notif: null,markers: resto.markers});
                    this.updateMarkers([query, {resto: true, qiblat: true}]);
                }
                else {
                    clearInterval(this.int[1]);
                    clearInterval(this.int[0]);
                    if (this.mount)
                        this.setState({markers: resto.markers});
                    // Revert back the markers (instead of showing empty marker)
                    if (temp.length>0)
                        resto = {markers: temp, done: [true, true]};
                    else
                        resto = {markers: -2, done: [false, false]};
                    let intt = setInterval(()=>{
                        if (query){
                            clearInterval(intt);
                            query = Object.assign({}, this.qT ? this.qT : query);
                            if (this.mount)
                                this.setState({markers: temp,loc: this.qT ? this.qT : query, notif: null});
                            if (this.mount)
                                this.map.fitToElements(true);
                        }
                    },10);

                    // Revert back the pickers' selected value to previously
                    Alert.alert(lg.alert.nointernet);
                    // UBAH KE SNACKBAR
                }
            } else if (temp2 != resto.markers.length || resto.done.every(v => v)) {
                if (this.mount)
                    this.setState({markers: resto.markers});
                if (resto.done.every(v => v)) {
                    clearInterval(this.int[1]);
                    clearInterval(this.int[0]);
                    this.loc ? this.loc.showCallout() : null;
                    if (this.mount)
                        this.setState({notif: lg.notif.finishresto.replace(/{length}/g,resto.markers.length)});
                    setTimeout(() => {
                        if (this.mount)
                            this.setState({notif: null});
                    }, 2000);
                    // Fetch other features' data as well
                }
                else if (resto.done[0]){
                    if (this.mount)
                        this.setState({notif: lg.notif.getpointresto});
                }
                else if (resto.done[1]){
                    if (this.mount)
                        this.setState({notif: lg.notif.getkeywordresto});
                }
                temp2 = resto.markers.length;
                if (this.mount)
                    this.map.fitToElements(true);
                this.qT = Object.assign({}, query);
                if (fetching && temp4) {
                    temp4 = false;
                    fetchData(fetching[0], fetching[1]);
                }
            }
        }, 100);
        // }
    }

    // Get new prayer time
    updateMarkers(fetching){
        // If the query is not Current location or Current location but location permission is granted
        if (this.state.markers != -1 || (query != null && query.lat != 0 && query.q != "Current location")) {
            // Wait for previous query assignment to be finished (from Home screen)
            this.int[2] = setInterval(() => {
                // If the var query is assigned
                if (query) {
                    // Clear the interval
                    clearInterval(this.int[2]);
                    // Retrieve the prayer time
                    resto={markers: [], done: [false, false]};
                    this.checkInternet(true, fetching);
                }
            }, 100);
        }
        else
        // If the location permission is not granted
            Alert.alert(lg.alert.nolocation);
        // UBAH KE SNACKBAR

    }


    render() {
        return (
            <View style={{flex:1, backgroundColor: "#E9E9EF"}}>
                <View style={{flex:1}}>
                    <MapView
                        provider="google"
                        loadingEnabled={true}
                        style={{flex:1}}
                        ref={map => {this.map = map}}
                        initialRegion={{
                            latitude: query && query.lat ? query.lat : -6.904391,
                            longitude: query && query.lng ? query.lng : 107.616946,
                            latitudeDelta: 0.0922,
                            longitudeDelta: 0.033,
                        }}
                        onPress={()=> {
                            if (this.tog)
                                if (this.mount)
                                    this.setState({show: null});
                        }}
                    >
                        { (this.state.loc && this.state.loc.lat) ?
                            (<MapView.Marker
                                ref={loc => this.loc = loc}
                                key="loc"
                                coordinate={{latitude: this.state.loc.lat, longitude: this.state.loc.lng}}
                                title={this.state.loc.q}
                                image={require('./img/png/img_mcurrent.png')}
                            />) : (<View/>)
                        }

                        {this.state.markers && this.state.markers.length>1 ? this.state.markers.map(marker => (
                            <MapView.Marker
                                key={marker.key}
                                coordinate={marker.coordinate}
                                onPress={()=>{
                                    this.tog = false
                                    if (this.mount)
                                        this.setState({show: marker.key});
                                    setTimeout(()=>{this.tog = true},100);
                                }}
                                title={marker.text}
                                description={lg.list.source+": "+marker.source}
                                image={require('./img/png/img_mresto.png')}
                            >
                            </MapView.Marker>
                        )):<View/>}

                    </MapView>
                </View>
                {
                    this.state.show != null ?
                        (<View style={{
                            position: "absolute",
                            bottom: 0,
                            width: '100%',
                            flex: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                            alignSelf: 'center',
                        }}>
                            <View style={{
                                // position: "absolute",
                                padding: 10,
                                margin: 10,
                                height: 100,
                                flex: 1,
                                backgroundColor: "white",
                                flexDirection: "row",
                                alignSelf: 'center',
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: '#dadada',
                            }}>
                                <View style={{alignItems: 'center',
                                    justifyContent: 'center',
                                    overflow: 'hidden',
                                    width: 100, height: 80, borderRadius: 5}}>
                                    <Image style={{width: 100, height: 80, borderRadius: 5, resizeMode: this.state.markers[this.state.show].photo != restodef ? 'cover' : 'contain'}}
                                           source={this.state.markers[this.state.show].photo == restodef ? require('./img/png/ic_resto.png') : {uri: this.state.markers[this.state.show].photo}} />
                                </View>
                                <View style={{marginLeft: 10, flexDirection: 'column', flex: 1}}>
                                    <Text style={{fontWeight: "bold", fontSize: 14, color: "#686868"}}>{this.state.markers[this.state.show].text}</Text>
                                    <Text style={{fontSize: 12, color: "#909090"}}>{lg.list.distance+": ~"+Math.round(this.state.markers[this.state.show].distance/100)/10 + lg.list.km}</Text>
                                    <Text style={{fontSize: 12, color: "#909090"}}>{lg.list.source}: {this.state.markers[this.state.show].source}</Text>
                                    <Text style={{fontWeight: 'normal', fontSize:12, color: this.state.markers[this.state.show].open ? '#13a89e' : '#909090'}}>{this.state.markers[this.state.show].open ? lg.list.open : this.state.markers[this.state.show].open === false ? lg.list.closed : lg.list.open_na}</Text>
                                </View>
                                <View style={{justifyContent: 'space-around'}}>
                                    <View style={{flex:1, alignItems: 'flex-end', justifyContent: 'flex-start'}}>
                                        <TouchableWithoutFeedback onPress={() => {
                                            if (this.mount)
                                                this.setState({show: null})}}>
                                            <Image source={require('./img/close.png')} style={{width: 24, height: 24, resizeMode: 'contain'}} />
                                        </TouchableWithoutFeedback>
                                    </View>
                                    <View style={{flex:1, alignItems: 'flex-end', justifyContent: 'flex-end'}}>
                                        <TouchableWithoutFeedback onPress={() => {
                                            track("Resto: Get direction from map to " + this.state.markers[this.state.show].text);
                                            getDirections(this.state.markers[this.state.show].dir)}}>
                                            <Image source={require('./img/direction.png')} style={{width: 24, height: 24, resizeMode: 'contain'}} />
                                        </TouchableWithoutFeedback>
                                    </View>
                                </View>
                            </View>
                        </View>) : <View/>}
                {
                    this.state.notif ?
                        (<View style={{
                            position: "absolute",
                            top: 0,
                            width: 360,
                            flex: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: "#303030"
                        }}>
                            <Text style={{fontWeight: "bold", color: "white"}}>{this.state.notif}</Text>
                        </View>) : <View/>}

            </View>
        );
    }
}

// PRAYER TIME
class Sholat extends React.Component {
    static navigationOptions = {
        headerTitle:
            <Image
                source={require('./img/png/img_htitle.png')}
                style={{
                    width: 110,
                    height: 40,
                    alignSelf: 'center',
                    resizeMode: 'contain'
                }} />,
        headerStyle: {
            backgroundColor: '#13a89e',
        },
        headerTintColor: '#fff',
        headerRight:
            <View/>
    };


    constructor(props) {
        super(props);
        // Set default value
        this.state = {data: prayer.data,
            year: prayer.time.year,
            month: prayer.time.month,
            year2: prayer.time.year,
            month2: prayer.time.month,
            show: false,
        };
    }

    // Temporary time, used to revert the date (month and year) on the picker when there is no connection during updateSchedule()
    timeT = {month: prayer.time.month, year: prayer.time.year};
    // Temporary query, used to revert the query on autocomplete search box when there is no connection during updateSchedule()
    qT = query ? query.q : "Current location";

    tempT = [];

    int = [0,0,0];

    mount = true;

    // To retrieve prayer time from API using updatePrayer() function
    checkInternet() {
        // Temporary prayer time, used to revert back when there is no connection during updateSchedule() (the screen is showing last prayer time instead of empty data)
        // Refresh the value of this.state.data
        // Retrieve prayer time
        updatePrayer(query, {month: this.state.month, year: this.state.year});
        // Wait for retrieval of prayer time (depends on internet connection)
        this.int[0] = setInterval(() => {
            // If the prayer time is retrieved, clear the interval and do other things
            if (prayer.data.length != 0) {
                clearInterval(this.int[0]);
                // If there is no internet connection
                if (prayer.data == -2) {
                    // Revert back the prayer time (instead of showing empty prayer time)
                    if (this.mount)
                        this.setState({data: this.tempT.length ? this.tempT : -2, month: this.timeT.month, year: this.timeT.year});
                    // Revert back the pickers' selected value to previously
                    if (this.tempT.length)
                        Alert.alert(lg.alert.nointernet);
                    // UBAH KE SNACKBAR
                }
                else {
                    if (this.mount)
                        this.setState({data: prayer.data});
                    if (this.place) {
                        this.place.setAddressText(query ? query.q : "Current location");
                        this.place._onBlur();
                    }
                    let int3 = setInterval(()=>{
                        if (this.flat) {
                            clearInterval(int3);
                            this.flat.scrollToIndex({
                                animated: true,
                                index: new Date().getMonth() + 1 == prayer.time.month && new Date().getFullYear() == prayer.time.year ? new Date().getDate() - 1 : 0
                            })
                        }
                    },10);
                    // If success, update temporary time to the latest assigned time (month and year)
                    this.timeT = {month: this.state.month, year: this.state.year};
                }
            }
        }, 100);
    }

    // Recheck for location permission whether there is a change
    async checkPermission() {
        // Check if the permission of location is not granted since Home screen (var prayer.data == -1)
        let {status} = await Permissions.askAsync(Permissions.LOCATION);
        // If the permission finally granted, update the prayer time
        if (status == "granted") {
            // Get current location
            location = await Location.getCurrentPositionAsync({enableHighAccuracy:true});

            // If there is no query assigned, set the default one (current location)
            if (query == null)
                query = {lat: location.coords.latitude, lng: location.coords.longitude, q: "Current location"};
            // Retrieve new prayer time
            this.updateSchedule([query, {prayer: true, qiblat: true}]);
            // this.checkInternet();
        }
        // If the permission still not be granted, throw error message
        else {
            track("!! Prayer: Tidak diberikan permission atas location");
            if (this.mount)
                this.setState({data: -1});
            // Alert.alert(lg.alert.nolocation);
        }
    }

    componentWillMount() {
    }

    componentDidMount() {
        if (this.place) {
            this.place.setAddressText(query ? query.q : "Current location");
            this.place._onBlur();
        }

        // If autocomplete search box is not empty, then set variable temporary query with it
        // if (this.place.getAddressText() != "")
        //     this.qT = this.place.getAddressText();

        // Wait for the prayer time to be retrieved
        this.int[1] = setInterval(() => {
            // If the prayer time is retrieved, clear the interval and do other things
            if (prayer.data.length != 0) {
                clearInterval(this.int[1]);
                if (this.mount)
                    this.setState({data: prayer.data});
                let int3 = setInterval(()=>{
                    if (this.flat) {
                        clearInterval(int3);
                        this.flat.scrollToIndex({
                            animated: true,
                            index: new Date().getMonth() + 1 == prayer.time.month && new Date().getFullYear() == prayer.time.year ? new Date().getDate() - 1 : 0
                        })
                    }
                },10);
                this.qT = query.q;
                // If the location permission is not granted on Home screem
                if (prayer.data == -1)
                    this.checkPermission();
                // If there is no internet connection from Home screen
                else if (prayer.data == -2)
                    this.updateSchedule([query, {prayer: true, qiblat: true}]);
                else if (this.place) {
                    // Set the autocomplete search box default value to Current location
                    this.place.setAddressText(query ? query.q : "Current location");
                    // this.place._handleChangeText(query ? query.q : "Current location");
                    this.place._onBlur();
                }
                // this.checkInternet();
            }
        }, 100);
    }

    componentWillUnmount() {
        this.mount = false;
        this.clearInt();
        menuopen = true;
    }

    clearInt(){
        for (let i in this.int)
            clearInterval(this.int[i]);
    }

    getItemLayout = (data, index) => (
        { length: data.length, offset: 57 * index, index}
    )

    // Get new prayer time
    updateSchedule(fetching){
        // If the query is not Current location or Current location but location permission is granted
        if ((this.state.data != -1 && this.tempT != -1) || (query != null && query.q != "Current location")) {
            // Wait for previous query assignment to be finished (from Home screen)
            this.int[2] = setInterval(() => {
                // If the var query is assigned
                if (query) {
                    // Clear the interval
                    clearInterval(this.int[2]);
                    // Retrieve the prayer time
                    this.checkInternet();
                    // Fetch other features' data as well
                    if (fetching)
                        fetchData(fetching[0], fetching[1]);
                }
            }, 100);
        }
        else {
            // If the location permission is not granted
            // if (this.tempT.length) {
            //     this.setState({data: this.tempT});
            //     Alert.alert(lg.alert.nolocation);
            //     // UBAH KE SNACKBAR
            // }
            // else
            if (this.mount)
                this.setState({data: -1});
        }

    }

    preUpdate(Q,T) {
        // If new query is assigned (selected/pressed), check for internet connection
        this.tempT = this.state.data && this.state.data.length>0 ? this.state.data.slice(0) : [];
        if (this.mount)
            this.setState({data:[]});
        fetch("http://api.aladhan.com").then(() => {
            this.clearInt();
            // If there is internet connection, then update current query and temporary query
            if (Q) {
                this.qT = Q.data.description;
                query = {lat: Q.details.geometry.location.lat, lng: Q.details.geometry.location.lng, q: Q.data.description};
                track("Prayer: Query for " + Q.data.description);
            }

            // Retrieve for new prayer time
            this.updateSchedule([query, {prayer: true, qiblat: true}]);
            track("Prayer: Month " + prayer.time.month + " year " + prayer.time.year);
        }).catch(err => {
            console.log(err.message);
            // If there is no internet connection, revert back the autocomplete search box to previous value
            this.place.setAddressText(this.qT);
            this.place._handleChangeText(this.qT);
            this.place._onBlur();
            if (this.mount)
                this.setState({month: this.timeT.month, year: this.timeT.year});
            if (this.mount)
                this.setState({data: this.tempT});
            Alert.alert(lg.alert.nointernet);
            // UBAH KE SNACKBAR
        })
    }

    render() {
        let month = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        return (
            <View style={{flex:1, backgroundColor: "#E9E9EF"}}>
                {this.state.data == -2 && !this.tempT.length ?
                    (<View style={{backgroundColor:'#E9E9EF', flex:1, alignItems:'center', justifyContent:'center'}}>
                        <Image source={require('./img/nowifi.png')} style={{width: 100, height: 100, resizeMode: 'contain'}} />
                        <Text>{lg.alert.nointernet}</Text>
                    </View>) :
                    !this.state.data.length && (!prayer || (prayer && !prayer.data.length)) ?
                        <Loading /> :
                        <GooglePlacesAutocomplete
                            ref={place => this.place = place}
                            placeholder='Search'
                            minLength={3}
                            autoFocus={false}
                            returnKeyType={'search'}
                            listViewDisplayed='false'
                            fetchDetails={true}
                            onPress={(data, details = null) => {
                                this.preUpdate({data: data, details: details});
                            }}
                            query={{
                                key: keyMap,
                            }}
                            currentLocation={true} // Will add a 'Current location' button at the top of the predefined places list
                            nearbyPlacesAPI='None'
                            textInputProps={{ selectTextOnFocus: true, onBlur: () => {
                                this.place._onBlur();
                                if(this.place.getAddressText() == ""){
                                    this.place.setAddressText(this.qT);
                                    this.place._handleChangeText(this.qT);
                                }
                            }, onEndEditing: () => {
                                this.place._onBlur();
                                if(this.place.getAddressText() == ""){
                                    this.place.setAddressText(this.qT);
                                    this.place._handleChangeText(this.qT);
                                }
                            }}}
                            styles={{
                                textInputContainer: {
                                    backgroundColor: '#f5f5f5'
                                },
                                textInput: {
                                    backgroundColor: '#fff',
                                    borderRadius: 4,
                                }
                            }}
                            renderRightButton={() =>
                                <TouchableWithoutFeedback
                                    onPress={() => {
                                        track("Mosque: Clear query");
                                        this.qT = this.place.getAddressText();
                                        this.place.setAddressText("");
                                        this.place._handleChangeText("");
                                        this.place.triggerFocus()
                                    }}>
                                    <View
                                        style={{
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            marginRight: 8,
                                        }}>
                                        <Image
                                            source={require('./img/png/ic_delete.png')}
                                            style={{
                                                width: 30,
                                                height: 30,
                                                alignSelf: 'center',
                                                resizeMode: 'contain'
                                            }}/>
                                    </View>
                                </TouchableWithoutFeedback>
                            }
                            enablePoweredByContainer={false}>
                            <View style={{flex: 1}}>
                                <View>
                                    {
                                        (Platform.OS === 'android') ?
                                            <View style={{flexDirection: "row", width: '70%', alignSelf: 'flex-end', alignItems: 'center', justifyContent: 'center', backgroundColor:'white', paddingHorizontal: 10, borderRadius: 20}}>
                                                <Image source={require('./img/png/ic_jadwal.png')} style={{width: 24, height: 24, marginHorizontal: 10, resizeMode: 'contain'}} />
                                                <Picker
                                                    itemStyle={{color:'white'}}
                                                    style={{flex: 1}}
                                                    selectedValue={(this.state && this.state.month) || new Date().getMonth() + 1}
                                                    onValueChange={(value) => {
                                                        // Update the state value with the selected value
                                                        if (this.mount)
                                                            this.setState({month: value});
                                                        // Retrieve new prayer time
                                                        this.preUpdate();
                                                        track("Prayer: Change month to " + value);
                                                    }}>
                                                    <Picker.Item label={lg.prayer.jan} value={1}/>
                                                    <Picker.Item label={lg.prayer.feb} value={2}/>
                                                    <Picker.Item label={lg.prayer.mar} value={3}/>
                                                    <Picker.Item label={lg.prayer.apr} value={4}/>
                                                    <Picker.Item label={lg.prayer.may} value={5}/>
                                                    <Picker.Item label={lg.prayer.jun} value={6}/>
                                                    <Picker.Item label={lg.prayer.jul} value={7}/>
                                                    <Picker.Item label={lg.prayer.aug} value={8}/>
                                                    <Picker.Item label={lg.prayer.sep} value={9}/>
                                                    <Picker.Item label={lg.prayer.oct} value={10}/>
                                                    <Picker.Item label={lg.prayer.nov} value={11}/>
                                                    <Picker.Item label={lg.prayer.dec} value={12}/>
                                                </Picker>
                                                <Picker
                                                    style={{flex: 1}}
                                                    selectedValue={(this.state && this.state.year) || new Date().getFullYear()}
                                                    onValueChange={(value) => {
                                                        // Update the state value with the selected value
                                                        if (this.mount)
                                                            this.setState({year: value});
                                                        // Retrieve new prayer time
                                                        this.preUpdate();
                                                        track("Prayer: Change year to " + value);
                                                    }}>
                                                    <Picker.Item label="2018" value={2018}/>
                                                    <Picker.Item label="2019" value={2019}/>
                                                    <Picker.Item label="2020" value={2020}/>
                                                    <Picker.Item label="2021" value={2021}/>
                                                    <Picker.Item label="2022" value={2022}/>
                                                </Picker>
                                            </View> :
                                            <TouchableWithoutFeedback onPress={()=>{
                                                this.setState({month2: this.state.month, year2: this.state.year, show: true});
                                            }}>
                                                <View style={{flexDirection: "row", alignSelf: 'flex-end', alignItems: 'center', justifyContent: 'center',
                                                    backgroundColor:'white', paddingHorizontal: 10, paddingVertical:10, borderRadius: 20}}>
                                                    <Image source={require('./img/png/ic_jadwal.png')} style={{width: 24, height: 24, marginHorizontal: 10, resizeMode: 'contain'}} />
                                                    <Text>{lg.prayer[month[this.state.month-1]]}</Text>
                                                    <Text style={{marginLeft: 5, marginRight: 10}}>{this.state.year} ▾</Text>
                                                </View>
                                            </TouchableWithoutFeedback>
                                    }
                                </View>
                                {
                                    // Show ActivityIndicator if the prayer time retrieval process is loading
                                    (this.state.data == -1 ?
                                        (<View style={{backgroundColor:'#E9E9EF', flex:1, alignItems:'center', justifyContent:'center'}}>
                                            <Image source={require('./img/nolocation.png')} style={{width: 100, height: 100, resizeMode: 'contain'}} />
                                            <Text>{lg.alert.nolocation}</Text>
                                        </View>):
                                        !this.state.data.length ? <Loading /> :
                                            <View style={{flex: 1}}>
                                                <View style={{
                                                    paddingVertical: 15,
                                                    paddingLeft: 10,
                                                    borderColor: '#dadada',
                                                    borderBottomWidth: 1,
                                                    borderTopWidth: 1,
                                                    backgroundColor: '#13A89E',
                                                    opacity: 0.7
                                                }}>
                                                    <View
                                                        style={{flexDirection: "row", justifyContent: 'center', alignItems: 'center'}}>
                                                        <Text style={{flex: 10, textAlign: 'center', fontWeight: 'bold', color: 'white'}}>{lg.prayer.date}</Text>
                                                        <Text style={{flex: 15, textAlign: 'center', fontWeight: 'bold', color: 'white'}}>{lg.prayer.fajr}</Text>
                                                        <Text style={{flex: 15, textAlign: 'center', fontWeight: 'bold', color: 'white'}}>{lg.prayer.dhuhr}</Text>
                                                        <Text style={{flex: 15, textAlign: 'center', fontWeight: 'bold', color: 'white'}}>{lg.prayer.asr}</Text>
                                                        <Text style={{flex: 15, textAlign: 'center', fontWeight: 'bold', color: 'white'}}>{lg.prayer.maghrib}</Text>
                                                        <Text style={{flex: 15, textAlign: 'center', fontWeight: 'bold', color: 'white'}}>{lg.prayer.isha}</Text>
                                                    </View>
                                                </View>
                                                <FlatList
                                                    ref={(ref) => {this.flat = ref}}
                                                    style={{flex: 1}}
                                                    data={this.state.data}
                                                    renderItem={({item}) => <Row2 tgl={item.tgl} sbh={item.sbh}
                                                                                  dhr={item.dhr} asr={item.asr}
                                                                                  mgr={item.mgr} isy={item.isy}/>}
                                                    updateCellsBatchingPeriod={100}
                                                    getItemLayout={this.getItemLayout}
                                                />
                                            </View>)
                                }
                            </View>
                        </GooglePlacesAutocomplete>
                }
                {this.state.show ?
                    <View style={{position: 'absolute',
                        top: 0,
                        right: 0,
                        bottom: 0,
                        left: 0,
                        flex: 1,alignItems: 'center',
                        justifyContent: 'center'}}>
                        <View style={{position: 'absolute',
                            top: 0,
                            right: 0,
                            bottom: 0,
                            left: 0,
                            opacity: 0.7,
                            flex: 1,
                            backgroundColor: 'black'}}>
                            <TouchableWithoutFeedback style={{flex:1}} onPress={()=>{this.setState({show: false})}}>
                                <View style={{
                                    flex: 1,
                                    alignItems: 'center',
                                    justifyContent: 'center'}}>
                                    <View style={{width: "80%", backgroundColor: "white", opacity: 1, borderRadius: 10,
                                        justifyContent: 'center'}}>

                                    </View>
                                </View>
                            </TouchableWithoutFeedback>
                        </View>
                        <View style={{width: "80%", height:300, marginTop: 10}}>
                            <View style={{
                                flex: 1,
                                alignItems: 'center',
                                justifyContent: 'center'}}>
                                <View style={{width: "100%", backgroundColor: "white", opacity: 1, borderRadius: 10,
                                    justifyContent: 'center'}}>
                                    <View style={{marginHorizontal: 10, marginTop: 10, flexDirection: "row", alignItems: 'center', justifyContent: 'center'}}>
                                        <Picker
                                            style={{flex: 1}}
                                            selectedValue={(this.state && this.state.month2) || new Date().getMonth() + 1}
                                            onValueChange={(value) => {
                                                // Update the state value with the selected value
                                                if (this.mount)
                                                    this.setState({month2: value});
                                                // Retrieve new prayer time
                                                track("Prayer: Change month to " + value);
                                            }}>
                                            <Picker.Item label={lg.prayer.jan} value={1}/>
                                            <Picker.Item label={lg.prayer.feb} value={2}/>
                                            <Picker.Item label={lg.prayer.mar} value={3}/>
                                            <Picker.Item label={lg.prayer.apr} value={4}/>
                                            <Picker.Item label={lg.prayer.may} value={5}/>
                                            <Picker.Item label={lg.prayer.jun} value={6}/>
                                            <Picker.Item label={lg.prayer.jul} value={7}/>
                                            <Picker.Item label={lg.prayer.aug} value={8}/>
                                            <Picker.Item label={lg.prayer.sep} value={9}/>
                                            <Picker.Item label={lg.prayer.oct} value={10}/>
                                            <Picker.Item label={lg.prayer.nov} value={11}/>
                                            <Picker.Item label={lg.prayer.dec} value={12}/>
                                        </Picker>
                                        <Picker
                                            style={{flex: 1}}
                                            selectedValue={(this.state && this.state.year2) || new Date().getFullYear()}
                                            onValueChange={(value) => {
                                                // Update the state value with the selected value
                                                if (this.mount)
                                                    this.setState({year2: value});
                                                // Retrieve new prayer time
                                                track("Prayer: Change year to " + value);
                                            }}>
                                            <Picker.Item label="2018" value={2018}/>
                                            <Picker.Item label="2019" value={2019}/>
                                            <Picker.Item label="2020" value={2020}/>
                                            <Picker.Item label="2021" value={2021}/>
                                            <Picker.Item label="2022" value={2022}/>
                                        </Picker>
                                    </View>
                                    <TouchableWithoutFeedback
                                        onPress={() => {
                                            this.setState({month: this.state.month2, year: this.state.year2, show: false});
                                            this.preUpdate();
                                        }}>
                                        <View style={{backgroundColor: '#13a89e', height: 50, paddingHorizontal: 10, borderRadius: 5,
                                            justifyContent: 'center', alignItems: 'center', marginHorizontal: 20, marginBottom: 20}}>
                                            <Text style={{color: 'white', fontWeight: 'bold', fontSize: 14}}>{lg.list.done}</Text>
                                        </View>
                                    </TouchableWithoutFeedback>
                                </View>
                            </View>
                        </View>
                    </View>
                    : <View/>}
            </View>)
    }
}

// QIBLA
class Qiblat extends React.Component {
    static navigationOptions = {
        headerTitle:
            <Image
                source={require('./img/png/img_htitle.png')}
                style={{
                    width: 110,
                    height: 40,
                    alignSelf: 'center',
                    resizeMode: 'contain'
                }} />,
        headerStyle: {
            backgroundColor: '#13a89e',
        },
        headerTintColor: '#fff',
        headerRight:
            <View/>
    };

    constructor() {
        super();
        this.state = {
            noloc: false
        };
    }

    int = [0,0];
    mount = true;

    // Recheck for location permission whether there is a change
    async checkPermission() {
        // Check if the permission of location is not granted since Home screen (var qibla == -1)
        let {status} = await Permissions.askAsync(Permissions.LOCATION);
        // If the permission finally granted, update the qibla
        if (status == "granted") {
            // Refresh the variable to null
            if (this.mount)
                this.setState({qiblat:null});

            // Get current location
            location = await Location.getCurrentPositionAsync({enableHighAccuracy:true});

            // If there is no query assigned, set the default one (current location)
            if (query == null)
                query = {lat: location.coords.latitude, lng: location.coords.longitude, q: "Current location"};

            // Calculate for qibla degree
            qiblat = updateQiblat();

            // Wait until the calculation for qibla degree is finished
            this.int[1] = setInterval(() => {
                // If the calculation is finished, stop the interval
                if (qiblat != null) {
                    clearInterval(this.int[1]);
                    if (this.mount)
                        this.setState({qiblat: qiblat});
                }
            }, 100);
        }
        // If the permission still not be granted, throw error message
        else {
            track("!! Qiblat: Tidak diberikan permission atas location");
            if (this.mount)
                this.setState({noloc: true});
        }
    }

    async componentDidMount() {
        // Set locationWatcher to null to refresh the compass (magnitude heading)
        locationWatcher = null;

        // Wait for qibla calculation to be finished
        this.int[0] = setInterval(() => {
            // If the calculation is finished, stop the interval
            if (qiblat != null) {
                clearInterval(this.int[0]);
                if (this.mount)
                    this.setState({qiblat: qiblat});
                // If the location permission is not granted (from Home screen), then call checkPermission() function
                if (qiblat == -1)
                    this.checkPermission();
            }
        }, 100);


        // Check if GPS is on or off. If off then encourage user to turn it on
        let gps = await Expo.Location.getProviderStatusAsync();
        if (this.mount)
            this.setState({gps: gps.gpsAvailable ? "" : "\n\n"+lg.alert.nogps});
    }

    componentWillUnmount() {
        this.mount = false;
        locationWatcher.then(loc => {loc.remove()});
        this.clearInt();
        menuopen = true;
    }

    clearInt(){
        for (let i in this.int)
            clearInterval(this.int[i]);
    }

    render() {
        let err = true;
        let text = <Loading />;
        // If any error occurs (ex: permission not granted)
        if (this.state.noloc)
            text = (<View style={{backgroundColor:'#E9E9EF', flex:1, alignItems:'center', justifyContent:'center'}}>
                <Image source={require('./img/nolocation.png')} style={{width: 100, height: 100, resizeMode: 'contain'}} />
                <Text>{lg.alert.nolocation}</Text>
            </View>);
        // If qibla degree is obtained
        if (this.state.qiblat > 0)
            err = false;
        return (
            <View style={styles.container3}>
                {err ? text :
                    <View style={styles.container3}><Compass degree={this.state.qiblat}/><Text style={{textAlign: 'center'}}>{lg.qibla.degree}: {this.state.qiblat}°</Text><Text style={{textAlign: 'center'}}>{"\n\n"+lg.alert.offelectronic
                    // Show GPS warning if GPS is off
                    +this.state.gps
                    }</Text>
                    </View>}
            </View>
        );
    }
}

// INFO
class Info extends React.Component {
    static navigationOptions = {
        headerTitle:
            <Image
                source={require('./img/png/img_htitle.png')}
                style={{
                    width: 110,
                    height: 40,
                    alignSelf: 'center',
                    resizeMode: 'contain'
                }} />,
        headerStyle: {
            backgroundColor: '#13a89e',
        },
        headerTintColor: '#fff',
        headerRight:
            <TouchableWithoutFeedback
                onPress={() => Linking.openURL(media_url)}>
                <View>
                    <Image
                        source={require('./img/png/ic_web.png')}
                        style={{
                            width: 24,
                            height: 24,
                            alignSelf: 'center',
                            resizeMode: 'contain',
                            margin: 20
                        }} />
                </View>
            </TouchableWithoutFeedback>
    };

    constructor(props) {
        super(props);
        this.state = {done: 0}
    }

    async componentWillMount(){
        await fetch(media_url).then(()=>{
            this.setState({done: 1});
        }).catch(err => {track("!! Media => check website: " + err.message); this.setState({done: -1});});
    }

    componentWillUnmount() {
        menuopen = true;
    }

    render() {
        return (

            (this.state.done == 1 ?
                <WebView
                    source={{uri: media_url}}
                /> : (this.state.done == -1 ? <View style={{backgroundColor:'#E9E9EF', flex:1, alignItems:'center', justifyContent:'center'}}>
                    <Image source={require('./img/nowifi.png')} style={{width: 100, height: 100, resizeMode: 'contain'}} />
                    <Text>{lg.alert.nointernet}</Text>
                </View> :
                    <View style={{backgroundColor:'#E9E9EF', flex:1, alignItems:'center', justifyContent:'center'}}>
                        <Loading />
                    </View>))
        );
    }
}

// FEEDBACK
class Feed extends React.Component {
    static navigationOptions = {
        headerTitle:
            <Image
                source={require('./img/png/img_htitle.png')}
                style={{
                    width: 110,
                    height: 40,
                    alignSelf: 'center',
                    resizeMode: 'contain'
                }} />,
        headerStyle: {
            backgroundColor: '#13a89e',
        },
        headerTintColor: '#fff',
        headerRight:
            <View/>
    };

    constructor(props) {
        super(props);
        this.state = {done: 0}
    }

    async componentWillMount(){
        await fetch(feed_url).then(()=>{
            this.setState({done: 1});
        }).catch(err => {track("!! Feed => check website: " + err.message); this.setState({done: -1});});
    }

    componentWillUnmount() {
        menuopen = true;
    }

    render() {
        return (

            (this.state.done == 1 ?
                <WebView
                    source={{uri: feed_url}}
                /> : (this.state.done == -1 ? <View style={{backgroundColor:'#E9E9EF', flex:1, alignItems:'center', justifyContent:'center'}}>
                    <Image source={require('./img/nowifi.png')} style={{width: 100, height: 100, resizeMode: 'contain'}} />
                    <Text>{lg.alert.nointernet}</Text>
                </View> :
                    <View style={{backgroundColor:'#E9E9EF', flex:1, alignItems:'center', justifyContent:'center'}}>
                        <Loading />
                    </View>))
        );
    }
}

// STACK NAVIGATOR
export default StackNavigator({
    // Start: {
    //     screen: Start,
    // },
    Home: {
        screen: App,
    },
    Trip: {
        screen: Trip,
    },
    Masjid: {
        screen: Masjid,
    },
    Qiblat: {
        screen: Qiblat,
    },
    Resto: {
        screen: Resto,
    },
    Resto2: {
        screen: Resto2,
    },
    Info: {
        screen: Info
    },
    Sholat: {
        screen: Sholat,
    } ,
    Feed: {
        screen: Feed
    }
}, {
    cardStyle: {
        paddingTop: StatusBar.currentHeight,
        backgroundColor: '#00796b'
    }
});
