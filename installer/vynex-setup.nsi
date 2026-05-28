Unicode True
!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

; ----- Constants -----
!define PRODUCT_NAME    "Vynex Server"
!define PRODUCT_VERSION "0.1.0"
!define PRODUCT_PUBLISHER "Vynex"
!define SERVICE_NAME    "VynexServer"
!define SERVICE_DISPLAY "Vynex POS Server"
!define UNINST_KEY      "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"

Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "vynex-server-setup.exe"
InstallDir "$PROGRAMFILES64\Vynex\Server"
InstallDirRegKey HKLM "${UNINST_KEY}" "InstallLocation"
RequestExecutionLevel admin
SetCompressor /SOLID lzma

; ----- MUI settings -----
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN_TEXT "Open health check in browser"
!define MUI_FINISHPAGE_RUN "http://localhost:3000/health"

; ----- Config page variables -----
Var Dialog
Var PortLabel
Var PortField
Var TursoUrlLabel
Var TursoUrlField
Var TursoTokenLabel
Var TursoTokenField
Var SyncIntervalLabel
Var SyncIntervalField

Var Port
Var TursoUrl
Var TursoToken
Var SyncInterval

; ----- Pages -----
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
Page custom ConfigPage ConfigPageLeave
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

; ================================================================
;  Config page — port + Turso credentials
; ================================================================
Function ConfigPage
  !insertmacro MUI_HEADER_TEXT \
    "Server Configuration" \
    "Set the listening port and optional Turso cloud sync credentials."

  nsDialogs::Create 1018
  Pop $Dialog
  ${If} $Dialog == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel}  0   0u 100% 12u "HTTP Port"
  Pop $PortLabel
  ${NSD_CreateText}   0  14u  60u 12u "3000"
  Pop $PortField

  ${NSD_CreateLabel}  0  34u 100% 12u \
    "Turso Database URL  (leave blank for local-only mode)"
  Pop $TursoUrlLabel
  ${NSD_CreateText}   0  48u 100% 12u ""
  Pop $TursoUrlField

  ${NSD_CreateLabel}  0  68u 100% 12u "Turso Auth Token"
  Pop $TursoTokenLabel
  ${NSD_CreatePassword} 0 82u 100% 12u ""
  Pop $TursoTokenField

  ${NSD_CreateLabel}  0 102u 100% 12u \
    "Cloud Sync Interval (seconds, default 60)"
  Pop $SyncIntervalLabel
  ${NSD_CreateText}   0 116u  60u 12u "60"
  Pop $SyncIntervalField

  nsDialogs::Show
FunctionEnd

Function ConfigPageLeave
  ${NSD_GetText} $PortField          $Port
  ${NSD_GetText} $TursoUrlField      $TursoUrl
  ${NSD_GetText} $TursoTokenField    $TursoToken
  ${NSD_GetText} $SyncIntervalField  $SyncInterval

  ${If} $Port == ""
    StrCpy $Port "3000"
  ${EndIf}
  ${If} $SyncInterval == ""
    StrCpy $SyncInterval "60"
  ${EndIf}
FunctionEnd

; ================================================================
;  Install
; ================================================================
Section "Install"
  SetOutPath "$INSTDIR"

  ; Copy binaries
  File "assets\vynex-server.exe"
  File "assets\nssm.exe"

  ; Create logs dir
  CreateDirectory "$INSTDIR\logs"

  ; Write .env — dotenv/config picks this up automatically because
  ; nssm sets AppDirectory to $INSTDIR (which becomes process.cwd())
  FileOpen  $0 "$INSTDIR\.env" w
  FileWrite $0 "PORT=$Port$\r$\n"
  FileWrite $0 "DB_PATH=$INSTDIR\vynex.db$\r$\n"
  FileWrite $0 "SYNC_INTERVAL_SECONDS=$SyncInterval$\r$\n"
  ${If} $TursoUrl != ""
    FileWrite $0 "TURSO_DATABASE_URL=$TursoUrl$\r$\n"
    FileWrite $0 "TURSO_AUTH_TOKEN=$TursoToken$\r$\n"
  ${EndIf}
  FileClose $0

  ; Remove any previous installation of the service (upgrade path)
  ExecWait '"$INSTDIR\nssm.exe" stop    ${SERVICE_NAME}' $0
  ExecWait '"$INSTDIR\nssm.exe" remove  ${SERVICE_NAME} confirm' $0

  ; Register Windows Service
  ExecWait '"$INSTDIR\nssm.exe" install ${SERVICE_NAME} "$INSTDIR\vynex-server.exe"'
  ExecWait '"$INSTDIR\nssm.exe" set ${SERVICE_NAME} DisplayName    "${SERVICE_DISPLAY}"'
  ExecWait '"$INSTDIR\nssm.exe" set ${SERVICE_NAME} Description    \
    "Vynex POS local server. Handles order routing, menu, and real-time table sync."'
  ExecWait '"$INSTDIR\nssm.exe" set ${SERVICE_NAME} AppDirectory   "$INSTDIR"'
  ExecWait '"$INSTDIR\nssm.exe" set ${SERVICE_NAME} Start          SERVICE_AUTO_START'
  ExecWait '"$INSTDIR\nssm.exe" set ${SERVICE_NAME} AppRestartDelay 3000'

  ; Log rotation: 10 MB per file
  ExecWait '"$INSTDIR\nssm.exe" set ${SERVICE_NAME} AppStdout        "$INSTDIR\logs\server.log"'
  ExecWait '"$INSTDIR\nssm.exe" set ${SERVICE_NAME} AppStderr        "$INSTDIR\logs\server.log"'
  ExecWait '"$INSTDIR\nssm.exe" set ${SERVICE_NAME} AppRotateFiles   1'
  ExecWait '"$INSTDIR\nssm.exe" set ${SERVICE_NAME} AppRotateBytes   10485760'

  ; Start immediately
  ExecWait '"$INSTDIR\nssm.exe" start ${SERVICE_NAME}'

  ; Add/Remove Programs entry
  WriteUninstaller "$INSTDIR\uninstall.exe"
  WriteRegStr   HKLM "${UNINST_KEY}" "DisplayName"     "${PRODUCT_NAME}"
  WriteRegStr   HKLM "${UNINST_KEY}" "UninstallString"  "$INSTDIR\uninstall.exe"
  WriteRegStr   HKLM "${UNINST_KEY}" "InstallLocation"  "$INSTDIR"
  WriteRegStr   HKLM "${UNINST_KEY}" "Publisher"        "${PRODUCT_PUBLISHER}"
  WriteRegStr   HKLM "${UNINST_KEY}" "DisplayVersion"   "${PRODUCT_VERSION}"
  WriteRegDWORD HKLM "${UNINST_KEY}" "NoModify"         1
  WriteRegDWORD HKLM "${UNINST_KEY}" "NoRepair"         1
SectionEnd

; ================================================================
;  Uninstall
; ================================================================
Section "Uninstall"
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "This will stop and remove the Vynex Server service.$\r$\n$\r$\nThe database file (vynex.db) will be deleted.$\r$\nBack it up first if you need to keep your data.$\r$\n$\r$\nContinue?" \
    IDYES +2
  Abort

  ExecWait '"$INSTDIR\nssm.exe" stop   ${SERVICE_NAME}'
  ExecWait '"$INSTDIR\nssm.exe" remove ${SERVICE_NAME} confirm'

  RMDir /r "$INSTDIR"

  DeleteRegKey HKLM "${UNINST_KEY}"
SectionEnd
