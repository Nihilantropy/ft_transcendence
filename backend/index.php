<?php
/**
 * ft_transcendence Backend Entry Point
 * 
 * @brief Main entry point for the PHP backend
 * This will be replaced with Node.js/Fastify when implementing the Web module
 */

// Enable error reporting for development
ini_set('display_errors', 0);
error_reporting(E_ALL);

// CORS headers for API
header('Access-Control-Allow-Origin: https://localhost');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Basic routing
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

switch ($path) {
    case '/api/health':
        echo json_encode(['status' => 'healthy', 'timestamp' => time()]);
        break;
    
    case '/api/info':
        echo json_encode([
            'app' => 'ft_transcendence',
            'version' => '1.0.0',
            'backend' => 'PHP',
            'message' => 'Ready to implement game logic!'
        ]);
        break;
    
    default:
        http_response_code(404);
        echo json_encode(['error' => 'Not Found']);
        break;
}
