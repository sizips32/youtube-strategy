
// Fix: Corrected the import statement for React and its hooks.
import React, { useState, useEffect } from 'react';
import { testApiKey } from '../services/youtubeService';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (apiKey: string) => void;
  currentApiKey: string;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave, currentApiKey }) => {
  const [apiKeyInput, setApiKeyInput] = useState(currentApiKey);
  const [testStatus, setTestStatus] = useState<'IDLE' | 'TESTING' | 'SUCCESS' | 'FAILURE'>('IDLE');

  useEffect(() => {
    setApiKeyInput(currentApiKey);
    setTestStatus('IDLE');
  }, [isOpen, currentApiKey]);

  if (!isOpen) return null;

  const handleTest = async () => {
    if (!apiKeyInput) {
        setTestStatus('FAILURE');
        return;
    }
    setTestStatus('TESTING');
    const isValid = await testApiKey(apiKeyInput);
    setTestStatus(isValid ? 'SUCCESS' : 'FAILURE');
  };

  const handleSave = () => {
    onSave(apiKeyInput);
    onClose();
  };

  const getStatusColor = () => {
    switch (testStatus) {
      case 'SUCCESS': return 'text-green-400';
      case 'FAILURE': return 'text-red-400';
      case 'TESTING': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusMessage = () => {
    switch (testStatus) {
      case 'SUCCESS': return 'API 키가 유효합니다.';
      case 'FAILURE': return 'API 키가 유효하지 않거나 할당량이 초과되었습니다.';
      case 'TESTING': return '연결 테스트 중...';
      default: return 'API 키를 입력하고 연결을 테스트하세요.';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50">
      <div className="bg-gray-800 rounded-lg p-8 w-full max-w-md shadow-xl border border-gray-700">
        <h2 className="text-2xl font-bold mb-4 text-white">YouTube API 키 설정</h2>
        <p className="text-gray-400 mb-6 text-sm">
          분석을 위해 YouTube Data API v3 키가 필요합니다. API 키는 로컬 드라이브에만 저장됩니다.
        </p>
        <input
          type="password"
          value={apiKeyInput}
          onChange={(e) => {
            setApiKeyInput(e.target.value);
            setTestStatus('IDLE');
          }}
          placeholder="API 키를 여기에 붙여넣으세요"
          className="w-full p-3 bg-gray-700 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
        />
        <p className={`mt-2 text-sm ${getStatusColor()}`}>{getStatusMessage()}</p>

        <div className="flex justify-between items-center mt-6">
          <button
            onClick={handleTest}
            disabled={testStatus === 'TESTING'}
            className="px-6 py-2 bg-blue-600 rounded hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed transition-colors"
          >
            {testStatus === 'TESTING' ? '테스트 중...' : '연결 테스트'}
          </button>
          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 rounded hover:bg-gray-700 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={!apiKeyInput}
              className="px-6 py-2 bg-green-600 rounded hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed transition-colors"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;