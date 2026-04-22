#!/bin/bash
# 使用 WiFi IP 启动 Expo 开发服务器

WIFI_IP="192.168.1.110"

echo "启动 Expo，使用 WiFi IP: $WIFI_IP"
REACT_NATIVE_PACKAGER_HOSTNAME=$WIFI_IP npx expo start