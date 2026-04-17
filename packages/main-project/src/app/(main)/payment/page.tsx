'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

interface Package {
  id: string;
  name: string;
  price: number;
  tokens: number;
  bonus: number;
  total_tokens: number;
}

export default function PaymentPage() {
  const router = useRouter();
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string>('basic');
  const [paymentMethod, setPaymentMethod] = useState<'wechat' | 'alipay'>('wechat');
  const [tokenBalance, setTokenBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [pkgData, balanceData] = await Promise.all([
        apiClient.getPaymentPackages(),
        apiClient.getTokenBalance(),
      ]);
      setPackages(pkgData || []);
      setTokenBalance(balanceData.balance || 0);
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createOrder() {
    setPaying(true);
    try {
      const order = await apiClient.createPaymentOrder({
        package: selectedPackage,
        payment_method: paymentMethod,
      });

      // 模拟支付成功（测试用）
      if (process.env.NODE_ENV === 'development') {
        await apiClient.mockPay(order.order_id);
        alert('支付成功！Token 已入账');
        loadData();
      } else {
        // 实际支付流程
        if (paymentMethod === 'wechat' && order.wechat_params) {
          // TODO: 调用微信支付
          alert('请在微信中完成支付');
        } else if (paymentMethod === 'alipay' && order.alipay_url) {
          window.open(order.alipay_url, '_blank');
        }
      }
    } catch (error: any) {
      alert(error.response?.data?.detail || '创建订单失败');
    } finally {
      setPaying(false);
    }
  }

  const selected = packages.find((p) => p.id === selectedPackage);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">加载中...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">购买 Token</h1>

        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="text-center">
            <div className="text-sm text-gray-500">当前 Token 余额</div>
            <div className="text-3xl font-bold text-blue-500">{tokenBalance}</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-medium mb-4">选择套餐</h2>
          <div className="grid grid-cols-3 gap-4">
            {packages.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => setSelectedPackage(pkg.id)}
                className={`p-4 rounded-lg text-center ${
                  selectedPackage === pkg.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <div className="font-medium">{pkg.name}</div>
                <div className="text-2xl font-bold mt-2">¥{pkg.price}</div>
                <div className="text-sm mt-1">{pkg.total_tokens} Token</div>
                {pkg.bonus > 0 && (
                  <div className="text-xs text-green-500 mt-1">赠送 {pkg.bonus}</div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-medium mb-4">支付方式</h2>
          <div className="flex gap-4">
            <button
              onClick={() => setPaymentMethod('wechat')}
              className={`flex-1 p-3 rounded-lg ${
                paymentMethod === 'wechat' ? 'bg-green-500 text-white' : 'bg-gray-100'
              }`}
            >
              微信支付
            </button>
            <button
              onClick={() => setPaymentMethod('alipay')}
              className={`flex-1 p-3 rounded-lg ${
                paymentMethod === 'alipay' ? 'bg-blue-500 text-white' : 'bg-gray-100'
              }`}
            >
              支付宝
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-medium mb-4">订单详情</h2>
          {selected && (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>套餐</span>
                <span>{selected.name}</span>
              </div>
              <div className="flex justify-between">
                <span>价格</span>
                <span className="font-medium">¥{selected.price}</span>
              </div>
              <div className="flex justify-between">
                <span>获得 Token</span>
                <span className="text-green-600 font-medium">{selected.total_tokens}</span>
              </div>
              {selected.bonus > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>赠送</span>
                  <span>+{selected.bonus}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={createOrder}
          disabled={paying}
          className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          {paying ? '处理中...' : '立即支付'}
        </button>

        <p className="text-center text-sm text-gray-500 mt-4">
          新用户首购享受 50% 折扣
        </p>
      </div>
    </div>
  );
}