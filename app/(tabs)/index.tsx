import React, { useState, useEffect } from 'react';
import { Platform, Text, View, StyleSheet } from 'react-native';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import { initializeApp } from "firebase/app";
import { getFirestore, setDoc } from "firebase/firestore";
import { doc } from 'firebase/firestore';
import * as geofire from 'geofire-common';
import { collection, query, orderBy, startAt, endAt, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAJ9Fs8SKz3AQkscId_VuoZ0XG2g59ISyU",
  authDomain: "chag-75cfe.firebaseapp.com",
  databaseURL: "https://chag-75cfe-default-rtdb.firebaseio.com",
  projectId: "chag-75cfe",
  storageBucket: "chag-75cfe.appspot.com",
  messagingSenderId: "801968476236",
  appId: "1:801968476236:web:731d1a01fef99dc913e4e9",
  measurementId: "G-BS7E11ECQW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);

const geostore = async () => {
  // Compute the GeoHash for a lat/lng point
  const lat = 53.485308755707074;
  const lng = -2.113766077799526;
  const hash = geofire.geohashForLocation([lat, lng]);

  // Add the hash and the lat/lng to the document. We will use the hash
  // for queries and the lat/lng for distance comparisons.
  await setDoc(doc(db, "cities", "man"), {
    geohash: hash,
    lat: lat,
    lng: lng
  });
}

const geoquery = async () => {
  // Find cities within 50km of London
  const center = [51.5074, 0.1278];
  const radiusInM = 268 * 1000;

  // Each item in 'bounds' represents a startAt/endAt pair. We have to issue
  // a separate query for each pair. There can be up to 9 pairs of bounds
  // depending on overlap, but in most cases there are 4.
  const bounds = geofire.geohashQueryBounds(center, radiusInM);
  const promises = [];
  for (const b of bounds) {
    const q = query(
      collection(db, 'cities'), 
      orderBy('geohash'), 
      startAt(b[0]), 
      endAt(b[1]));

    promises.push(getDocs(q));
  }

  // Collect all the query results together into a single list
  const snapshots = await Promise.all(promises);

  const matchingDocs = [];
  for (const snap of snapshots) {
    for (const doc of snap.docs) {
      const lat = doc.get('lat');
      const lng = doc.get('lng');

      // We have to filter out a few false positives due to GeoHash
      // accuracy, but most will match
      const distanceInKm = geofire.distanceBetween([lat, lng], center);
      const distanceInM = distanceInKm * 1000;
      if (distanceInM <= radiusInM) {
        matchingDocs.push(doc.data());
      }
    }
  }
  return matchingDocs;
}

export default function App() {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [cities, setCities] = useState([]);

  useEffect(() => {
    (async () => {
      if (Platform.OS === 'android' && !Device.isDevice) {
        setErrorMsg(
          'Oops, this will not work on Snack in an Android Emulator. Try it on your device!'
        );
        return;
      }
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation(location);
    })();
  }, []);

  useEffect(() => {
    geostore();
  }, []);

  useEffect(() => {
    (async () => {
      const result = await geoquery();
      setCities(result);
    })();
  }, []);

  let text = 'Waiting..';
  if (errorMsg) {
    text = errorMsg;
  } else if (location) {
    text = JSON.stringify('lat: ' + location.coords.latitude + ', long: ' + location.coords.longitude);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.paragraph}>{text}</Text>
      {cities.length > 0 && (
        <View>
          <Text style={styles.paragraph}>Cities within radius:</Text>
          {cities.map((city, index) => (
            <Text key={index} style={styles.paragraph}>{JSON.stringify(city)}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  paragraph: {
    fontSize: 18,
    textAlign: 'center',
  },
});