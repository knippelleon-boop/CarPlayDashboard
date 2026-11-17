import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Linking,
  FlatList,
  SafeAreaView,
  StatusBar,
  Alert,
  useWindowDimensions,
} from 'react-native';
import MapView from 'react-native-maps';
import * as Location from 'expo-location';
import * as Contacts from 'expo-contacts';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';

type ActiveTab = 'dashboard' | 'contacts';

export default function App() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [orientationLocked, setOrientationLocked] = useState<
    'auto' | 'landscape' | 'portrait'
  >('auto');
  const [region, setRegion] = useState({
    latitude: 50.2581,
    longitude: 9.2814,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  });
  const [contacts, setContacts] = useState<Contacts.Contact[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    // Standardmäßig automatische Drehung erlauben
    ScreenOrientation.unlockAsync();

    // Uhrzeit aktualisieren
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      );
    }, 1000);

    // Standort abrufen
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setRegion((prev) => ({
          ...prev,
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        }));
      }
    })();

    // Kontakte laden
    (async () => {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.PhoneNumbers],
        });
        const valid = data.filter(
          (c) => c.phoneNumbers && c.phoneNumbers.length > 0
        );
        setContacts(valid.slice(0, 30));
      }
    })();

    return () => clearInterval(timer);
  }, []);

  // Manueller Umschalter zwischen Hochformat, Querformat und Auto
  const toggleOrientation = async () => {
    if (isLandscape) {
      await ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP
      );
      setOrientationLocked('portrait');
    } else {
      await ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT
      );
      setOrientationLocked('landscape');
    }
  };

  const openGoogleMaps = async () => {
    const url = 'comgooglemaps://';
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Linking.openURL('https://maps.google.com');
    }
  };

  const openSpotify = async () => {
    const url = 'spotify://';
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Spotify', 'Spotify ist auf diesem iPhone nicht installiert.');
    }
  };

  const callNumber = (phoneNumber?: string) => {
    if (!phoneNumber) return;
    const cleaned = phoneNumber.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleaned}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar hidden={isLandscape} barStyle="light-content" />

      <View
        style={[
          styles.mainLayout,
          isLandscape ? styles.layoutLandscape : styles.layoutPortrait,
        ]}
      >
        {/* CarPlay-Dock: Im Querformat links, im Hochformat unten */}
        <View
          style={[
            styles.sidebar,
            isLandscape ? styles.sidebarLandscape : styles.sidebarPortrait,
          ]}
        >
          <Text style={styles.clock}>{currentTime || '12:00'}</Text>

          <TouchableOpacity style={styles.dockIcon} onPress={openGoogleMaps}>
            <Ionicons name="navigate-circle" size={34} color="#4285F4" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.dockIcon} onPress={openSpotify}>
            <FontAwesome5 name="spotify" size={30} color="#1DB954" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.dockIcon,
              activeTab === 'contacts' && styles.dockIconActive,
            ]}
            onPress={() =>
              setActiveTab(activeTab === 'contacts' ? 'dashboard' : 'contacts')
            }
          >
            <Ionicons name="call" size={28} color="#34C759" />
          </TouchableOpacity>

          {/* Button zum Drehen zwischen Hoch- und Querformat */}
          <TouchableOpacity
            style={styles.dockIcon}
            onPress={toggleOrientation}
          >
            <Ionicons name="phone-portrait-outline" size={26} color="#FF9F0A" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridButton}
            onPress={() => setActiveTab('dashboard')}
          >
            <Ionicons name="apps" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Hauptbereich */}
        {activeTab === 'dashboard' ? (
          <View
            style={[
              styles.dashboardGrid,
              isLandscape ? styles.gridLandscape : styles.gridPortrait,
            ]}
          >
            {/* Karten-Widget */}
            <View
              style={[
                styles.mapCard,
                isLandscape ? { flex: 1.25 } : { flex: 1.15 },
              ]}
            >
              <MapView
                style={styles.map}
                region={region}
                showsUserLocation
                userInterfaceStyle="dark"
              />
              <TouchableOpacity
                style={styles.googleMapsOverlayBtn}
                onPress={openGoogleMaps}
              >
                <Ionicons name="navigate" size={18} color="#fff" />
                <Text style={styles.overlayBtnText}>Google Maps Route</Text>
              </TouchableOpacity>
            </View>

            {/* Rechte / Untere Widgets (Spotify + Telefon) */}
            <View
              style={[
                styles.widgetsColumn,
                isLandscape ? { flex: 1 } : { flex: 0.95 },
              ]}
            >
              {/* Spotify-Widget */}
              <View style={styles.musicCard}>
                <View style={styles.musicHeader}>
                  <FontAwesome5 name="spotify" size={20} color="#1DB954" />
                  <Text style={styles.widgetLabel}>Spotify Player</Text>
                </View>
                <Text style={styles.trackTitle} numberOfLines={1}>
                  Bereit zur Wiedergabe
                </Text>
                <Text style={styles.artistName} numberOfLines={1}>
                  Tippe auf Spotify zum Starten
                </Text>

                <View style={styles.controlsRow}>
                  <TouchableOpacity onPress={openSpotify}>
                    <Ionicons name="play-skip-back" size={26} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.playBtn}
                    onPress={() => {
                      setIsPlaying(!isPlaying);
                      openSpotify();
                    }}
                  >
                    <Ionicons
                      name={isPlaying ? 'pause' : 'play'}
                      size={26}
                      color="#000"
                    />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={openSpotify}>
                    <Ionicons name="play-skip-forward" size={26} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Schnellzugriff Telefon & Kontakte */}
              <TouchableOpacity
                style={styles.phoneCard}
                onPress={() => setActiveTab('contacts')}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.tempText}>Telefon & Kontakte</Text>
                  <Text style={styles.subText} numberOfLines={1}>
                    {contacts.length} Kontakte – Tippen zum Anrufen
                  </Text>
                </View>
                <Ionicons name="people-circle" size={40} color="#34C759" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* Kontaktliste-Ansicht (passt Spaltenzahl an Hoch-/Querformat an) */
          <View style={styles.contactsContainer}>
            <View style={styles.contactsHeader}>
              <Text style={styles.contactsTitle}>Kontakte</Text>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => setActiveTab('dashboard')}
              >
                <Text style={styles.backBtnText}>Dashboard</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              key={isLandscape ? 'landscape-list' : 'portrait-list'}
              data={contacts}
              keyExtractor={(item, index) => item.id || String(index)}
              numColumns={isLandscape ? 2 : 1}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.contactItem}
                  onPress={() => callNumber(item.phoneNumbers?.[0]?.number)}
                >
                  <Ionicons name="call" size={22} color="#34C759" />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={styles.contactName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.contactNumber}>
                      {item.phoneNumbers?.[0]?.number}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0D12',
  },
  mainLayout: {
    flex: 1,
    padding: 10,
  },
  layoutLandscape: {
    flexDirection: 'row',
  },
  layoutPortrait: {
    flexDirection: 'column-reverse',
  },
  sidebar: {
    backgroundColor: '#161A23',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sidebarLandscape: {
    width: 72,
    flexDirection: 'column',
    paddingVertical: 12,
    marginRight: 12,
  },
  sidebarPortrait: {
    height: 70,
    flexDirection: 'row',
    paddingHorizontal: 14,
    marginTop: 10,
  },
  clock: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  dockIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#222834',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockIconActive: {
    borderWidth: 2,
    borderColor: '#34C759',
  },
  gridButton: {
    padding: 6,
  },
  dashboardGrid: {
    flex: 1,
    gap: 12,
  },
  gridLandscape: {
    flexDirection: 'row',
  },
  gridPortrait: {
    flexDirection: 'column',
  },
  mapCard: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#1C212B',
  },
  map: {
    flex: 1,
  },
  googleMapsOverlayBtn: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    backgroundColor: '#1A73E8',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 8,
  },
  overlayBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  widgetsColumn: {
    gap: 12,
  },
  musicCard: {
    flex: 1.35,
    backgroundColor: '#1C212B',
    borderRadius: 22,
    padding: 16,
    justifyContent: 'space-between',
  },
  musicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  widgetLabel: {
    color: '#9BA3B4',
    fontSize: 13,
    fontWeight: '600',
  },
  trackTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  artistName: {
    color: '#9BA3B4',
    fontSize: 13,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 4,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneCard: {
    flex: 0.75,
    backgroundColor: '#1C212B',
    borderRadius: 22,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tempText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  subText: {
    color: '#9BA3B4',
    fontSize: 12,
    marginTop: 2,
  },
  contactsContainer: {
    flex: 1,
    backgroundColor: '#161A23',
    borderRadius: 22,
    padding: 16,
  },
  contactsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactsTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  backBtn: {
    backgroundColor: '#2A3140',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  contactItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222834',
    padding: 14,
    borderRadius: 14,
    margin: 5,
  },
  contactName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  contactNumber: {
    color: '#9BA3B4',
    fontSize: 13,
  },
});