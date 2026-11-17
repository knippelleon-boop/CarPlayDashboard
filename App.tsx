import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  Linking,
  Alert,
  StatusBar,
  useWindowDimensions,
  SafeAreaView,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Contacts from 'expo-contacts';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri, useAuthRequest, ResponseType } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

const SPOTIFY_CLIENT_ID = '1f58a4a457b14341b9c7f7240a3529b6';

const spotifyDiscovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

interface QuickContact {
  id: string;
  name: string;
  phone: string;
}

interface TrackInfo {
  title: string;
  artist: string;
  albumArt?: string;
  isPlaying: boolean;
}

export default function App() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  // Uhrzeit & Datum
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');

  // Standort & Apple Maps Route
  const [region, setRegion] = useState({
    latitude: 50.2586,
    longitude: 9.2903,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  });
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [destCoords, setDestCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [destinationInput, setDestinationInput] = useState('');
  const [routeLabel, setRouteLabel] = useState<string | null>(null);

  // Echte iPhone-Kontakte
  const [contacts, setContacts] = useState<QuickContact[]>([]);
  const [contactsStatus, setContactsStatus] = useState('Lade Kontakte...');

  // Spotify Status
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [track, setTrack] = useState<TrackInfo | null>(null);

  const redirectUri = makeRedirectUri({
    scheme: 'cardashboard',
    path: 'callback',
  });

  const [request, response, promptAsync] = useAuthRequest(
    {
      responseType: ResponseType.Token,
      clientId: SPOTIFY_CLIENT_ID,
      scopes: [
        'user-read-currently-playing',
        'user-read-playback-state',
        'user-modify-playback-state',
      ],
      usePKCE: false,
      redirectUri,
    },
    spotifyDiscovery
  );

  // 1. Live-Uhrzeit aktualisieren
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
      setDateStr(now.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' }));
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. Live-GPS Standort für Apple Maps anfordern
  useEffect(() => {
    let locationSub: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Standort deaktiviert', 'Bitte erlaube den Standortzugriff in den iPhone-Einstellungen.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
      setUserCoords(coords);
      setRegion((prev) => ({ ...prev, ...coords }));

      locationSub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 15 },
        (loc) => {
          setUserCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }
      );
    })();
    return () => {
      if (locationSub) locationSub.remove();
    };
  }, []);

  // 3. Echte iPhone-Kontakte laden
  useEffect(() => {
    (async () => {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        setContactsStatus('Kein Zugriff auf Kontakte erlaubt');
        return;
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });

      const validContacts: QuickContact[] = data
        .filter((c) => c.name && c.phoneNumbers && c.phoneNumbers.length > 0)
        .slice(0, 12)
        .map((c, idx) => ({
          id: c.id || String(idx),
          name: c.name || 'Unbekannt',
          phone: c.phoneNumbers![0].number || '',
        }));

      if (validContacts.length === 0) {
        setContactsStatus('Keine Kontakte mit Telefonnummer gefunden');
      } else {
        setContacts(validContacts);
      }
    })();
  }, []);

  // 4. Spotify Login-Antwort verarbeiten & aktuellen Song abrufen
  useEffect(() => {
    if (response?.type === 'success') {
      const { access_token } = response.params;
      setSpotifyToken(access_token);
    }
  }, [response]);

  useEffect(() => {
    if (!spotifyToken) return;

    const fetchCurrentTrack = async () => {
      try {
        const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
          headers: { Authorization: `Bearer ${spotifyToken}` },
        });
        if (res.status === 204 || res.status > 400) return;
        const json = await res.json();
        if (json && json.item) {
          setTrack({
            title: json.item.name,
            artist: json.item.artists.map((a: any) => a.name).join(', '),
            albumArt: json.item.album?.images?.[0]?.url,
            isPlaying: json.is_playing,
          });
        }
      } catch {
        // Stiller Fallback bei Netzwerkwechsel unterwegs
      }
    };

    fetchCurrentTrack();
    const poll = setInterval(fetchCurrentTrack, 4000);
    return () => clearInterval(poll);
  }, [spotifyToken]);

  // Route auf der Karte einzeichnen
  const handleSearchRoute = async () => {
    if (!destinationInput.trim()) return;
    try {
      const results = await Location.geocodeAsync(destinationInput);
      if (results.length > 0) {
        const target = {
          latitude: results[0].latitude,
          longitude: results[0].longitude,
        };
        setDestCoords(target);
        setRouteLabel(destinationInput.trim());
        setRegion({
          latitude: target.latitude,
          longitude: target.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      } else {
        Alert.alert('Ziel nicht gefunden', 'Bitte gib eine genauere Adresse oder Stadt ein.');
      }
    } catch {
      Alert.alert('Fehler', 'Adresse konnte nicht gesucht werden.');
    }
  };

  // Sprachnavigation direkt in Apple Maps starten
  const openAppleMapsTurnByTurn = () => {
    if (!destCoords) return;
    const url = `http://maps.apple.com/?daddr=${destCoords.latitude},${destCoords.longitude}&dirflg=d`;
    Linking.openURL(url);
  };

  // Spotify Steuerung
  const controlSpotify = async (action: 'play' | 'pause' | 'next' | 'previous') => {
    if (!spotifyToken) {
      Linking.openURL('spotify://');
      return;
    }
    const method = action === 'next' || action === 'previous' ? 'POST' : 'PUT';
    await fetch(`https://api.spotify.com/v1/me/player/${action}`, {
      method,
      headers: { Authorization: `Bearer ${spotifyToken}` },
    });
    if (track && (action === 'play' || action === 'pause')) {
      setTrack({ ...track, isPlaying: action === 'play' });
    }
  };

  const callContact = (phone: string) => {
    const cleaned = phone.replace(/\s+/g, '');
    Linking.openURL(`tel:${cleaned}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Obere Statusleiste */}
      <View style={styles.topBar}>
        <Text style={styles.clockText}>{timeStr}</Text>
        <Text style={styles.appTitle}>CAR DASHBOARD</Text>
        <Text style={styles.dateText}>{dateStr}</Text>
      </View>

      {/* Hauptbereich: Querformat nebeneinander, Hochformat untereinander */}
      <View style={[styles.mainGrid, { flexDirection: isLandscape ? 'row' : 'column' }]}>
        
        {/* LINKE SEITE: Apple Maps Live-Karte & Route */}
        <View style={[styles.card, { flex: isLandscape ? 1.35 : 1.1 }]}>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.input}
              placeholder="Ziel eingeben (z. B. Frankfurt Hbf)..."
              placeholderTextColor="#8E8E93"
              value={destinationInput}
              onChangeText={setDestinationInput}
              onSubmitEditing={handleSearchRoute}
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.goBtn} onPress={handleSearchRoute}>
              <Text style={styles.goBtnText}>Route</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.mapWrapper}>
            <MapView
              style={styles.map}
              region={region}
              showsUserLocation={true}
              followsUserLocation={!destCoords}
              userInterfaceStyle="dark"
            >
              {destCoords && <Marker coordinate={destCoords} title={routeLabel || 'Ziel'} />}
              {userCoords && destCoords && (
                <Polyline
                  coordinates={[userCoords, destCoords]}
                  strokeColor="#0A84FF"
                  strokeWidth={5}
                />
              )}
            </MapView>

            {destCoords && (
              <TouchableOpacity style={styles.navStartBanner} onPress={openAppleMapsTurnByTurn}>
                <Text style={styles.navStartText}>
                  Navigation nach „{routeLabel}“ starten ➔
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* RECHTE SEITE: Spotify Musik & Echte Kontakte */}
        <View style={[styles.rightColumn, { flex: 1 }]}>
          
          {/* Spotify Widget */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>MUSIK (SPOTIFY)</Text>
            {track ? (
              <View style={styles.trackRow}>
                {track.albumArt ? (
                  <Image source={{ uri: track.albumArt }} style={styles.albumArt} />
                ) : (
                  <View style={[styles.albumArt, styles.albumPlaceholder]} />
                )}
                <View style={styles.trackMeta}>
                  <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                  <Text style={styles.trackArtist} numberOfLines={1}>{track.artist}</Text>
                  <View style={styles.controlsRow}>
                    <TouchableOpacity style={styles.ctrlBtn} onPress={() => controlSpotify('previous')}>
                      <Text style={styles.ctrlText}>⏮</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.ctrlBtn, styles.playBtn]}
                      onPress={() => controlSpotify(track.isPlaying ? 'pause' : 'play')}
                    >
                      <Text style={styles.ctrlText}>{track.isPlaying ? '⏸' : '▶'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.ctrlBtn} onPress={() => controlSpotify('next')}>
                      <Text style={styles.ctrlText}>⏭</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.spotifyConnectBox}>
                <Text style={styles.hintText}>
                  Mit Spotify verbinden für Live-Songtitel
                </Text>
                <TouchableOpacity
                  style={styles.spotifyBtn}
                  onPress={() => promptAsync()}
                >
                  <Text style={styles.spotifyBtnText}>
                    Mit Spotify verbinden
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Echte iPhone-Kontakte */}
          <View style={[styles.card, { flex: 1 }]}>
            <Text style={styles.sectionHeader}>SCHNELLANRUF (KONTAKTE)</Text>
            {contacts.length > 0 ? (
              <FlatList
                data={contacts}
                keyExtractor={(item) => item.id}
                numColumns={2}
                columnWrapperStyle={{ gap: 8 }}
                contentContainerStyle={{ gap: 8 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.contactChip}
                    onPress={() => callContact(item.phone)}
                  >
                    <Text style={styles.contactName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.contactSub} numberOfLines={1}>Anrufen</Text>
                  </TouchableOpacity>
                )}
              />
            ) : (
              <Text style={styles.hintText}>{contactsStatus}</Text>
            )}
          </View>

        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0D12',
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  clockText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  appTitle: {
    color: '#64D2FF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  dateText: {
    color: '#98989D',
    fontSize: 15,
    fontWeight: '600',
  },
  mainGrid: {
    flex: 1,
    gap: 10,
  },
  rightColumn: {
    gap: 10,
  },
  card: {
    backgroundColor: '#161922',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#252A38',
  },
  sectionHeader: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#222634',
    color: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  goBtn: {
    backgroundColor: '#0A84FF',
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  goBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  mapWrapper: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  navStartBanner: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: '#30D158',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  navStartText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 15,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  albumArt: {
    width: 68,
    height: 68,
    borderRadius: 12,
  },
  albumPlaceholder: {
    backgroundColor: '#2C2C2E',
  },
  trackMeta: {
    flex: 1,
  },
  trackTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  trackArtist: {
    color: '#AEAEB2',
    fontSize: 13,
    marginBottom: 8,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  ctrlBtn: {
    backgroundColor: '#262B3A',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  playBtn: {
    backgroundColor: '#1DB954',
  },
  ctrlText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  spotifyConnectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  spotifyBtn: {
    backgroundColor: '#1DB954',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  spotifyBtnText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 13,
  },
  contactChip: {
    flex: 1,
    backgroundColor: '#222634',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2F3547',
  },
  contactName: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  contactSub: {
    color: '#30D158',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  hintText: {
    color: '#98989D',
    fontSize: 13,
    flex: 1,
  },
});
