# macOS imzalama ve yayın (GitHub Actions)

`.github/workflows/mac-release.yml` iki iş çalıştırır:

| İş | Çıktı | Sertifika | Nereye |
|---|---|---|---|
| `dmg` | `MaliPen-mac.dmg` + `.zip` (universal) | Developer ID Application | GitHub Release (otomatik güncelleme) |
| `mas` | `MaliPen-mas-<sürüm>.pkg` (universal) | Apple Distribution + Mac Installer Distribution | Actions artifact, istenirse App Store Connect |

Tetikleme: `v*` etiketi push edilince ikisi de çalışır. Actions sekmesinden **Run workflow** ile elle de çalıştırılabilir (App Store'a yükleme yalnızca elle, `upload_to_app_store` işaretlenince).

## Gerekli repository secrets

Settings → Secrets and variables → Actions → New repository secret

### DMG (Developer ID + notarization)
| Secret | Değer |
|---|---|
| `MAC_DEVELOPER_ID_P12_BASE64` | "Developer ID Application" sertifikası (.p12) base64 |
| `MAC_DEVELOPER_ID_P12_PASSWORD` | .p12 dışa aktarırken verilen şifre |
| `APPLE_ID` | Apple Developer hesabının e-postası |
| `APPLE_APP_SPECIFIC_PASSWORD` | appleid.apple.com → Uygulamaya özel şifre |
| `APPLE_TEAM_ID` | `V69W4LSB27` |

### Mac App Store
| Secret | Değer |
|---|---|
| `MAS_CERTS_P12_BASE64` | **Apple Distribution** ve **Mac Installer Distribution** sertifikaları tek .p12 içinde, base64 |
| `MAS_CERTS_P12_PASSWORD` | o .p12'nin şifresi |
| `MAS_PROVISION_PROFILE_BASE64` | `build/MaliPen_Mac_App_Store.provisionprofile` base64 (dosya .gitignore'da, repoya girmez) |
| `APP_STORE_CONNECT_KEY_ID` | (yükleme için) App Store Connect API anahtar kimliği |
| `APP_STORE_CONNECT_ISSUER_ID` | (yükleme için) Issuer ID |
| `APP_STORE_CONNECT_KEY_P8` | (yükleme için) `AuthKey_XXXX.p8` dosyasının metni |

## Sertifikaları .p12 olarak alma (Mac)

1. Anahtar Zinciri Erişimi → Oturum Aç → Sertifikalarım.
2. Sertifikayı (anahtarıyla birlikte) seç → sağ tık → **Dışa Aktar** → `.p12`, şifre ver.
   MAS için iki sertifikayı birlikte seçip tek dosyaya aktar.
3. Base64'e çevirip panoya kopyala:

```bash
base64 -i DeveloperID.p12 | pbcopy
base64 -i MAS.p12 | pbcopy
base64 -i build/MaliPen_Mac_App_Store.provisionprofile | pbcopy
```

## Yeni sürüm çıkarmak

```bash
# package.json "version" alanını artır, sonra:
git commit -am "Sürüm 1.0.5"
git tag v1.0.5
git push origin main --tags
```

## Notlar
- MAS sürümü sandbox içindedir: ekran görüntüsü kaydederken her zaman kaydetme penceresi açılır (sandbox yalnızca kullanıcının seçtiği yere yazmaya izin verir). Otomatik güncelleme MAS sürümünde kapalıdır.
- `build/entitlements.mas.plist` içindeki Team ID / bundle id provisioning profile ile aynı olmalıdır.
- Provisioning profile'ın son kullanma tarihi: 30 Eylül 2027.
