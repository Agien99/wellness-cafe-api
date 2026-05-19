<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\InventoryItem;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    /**
     * GET /api/reports/dashboard
     * Returns the headline KPIs the dashboard widget shows.
     */
    public function dashboard(): JsonResponse
    {
        $today    = Carbon::today();
        $yesterday= Carbon::yesterday();
        $monthStart = Carbon::now()->startOfMonth();

        $todayOrders = Order::whereDate('created_at', $today)->get();
        $yOrders     = Order::whereDate('created_at', $yesterday)->get();
        $monthOrders = Order::where('created_at', '>=', $monthStart)->get();

        $todaySales = (float) $todayOrders->sum('total');
        $ySales     = (float) $yOrders->sum('total');
        $delta = $ySales > 0 ? round((($todaySales - $ySales) / $ySales) * 100, 1) : 0;

        // Top 5 selling products (by units)
        $topProducts = DB::table('order_items')
            ->select('product_id', 'name', DB::raw('SUM(qty) as units'), DB::raw('SUM(price * qty) as revenue'))
            ->groupBy('product_id', 'name')
            ->orderByDesc('units')
            ->limit(5)->get();

        // 14-day sales trend
        $trend = [];
        for ($d = 13; $d >= 0; $d--) {
            $date = Carbon::today()->subDays($d);
            $trend[] = [
                'date'    => $date->toDateString(),
                'label'   => $date->format('d M'),
                'revenue' => (float) Order::whereDate('created_at', $date)->sum('total'),
            ];
        }

        return response()->json([
            'today' => [
                'sales'      => round($todaySales, 2),
                'orders'     => $todayOrders->count(),
                'delta_pct'  => $delta,
            ],
            'yesterday' => [
                'sales'  => round($ySales, 2),
                'orders' => $yOrders->count(),
            ],
            'month' => [
                'sales'  => round((float) $monthOrders->sum('total'), 2),
                'orders' => $monthOrders->count(),
            ],
            'customers' => [
                'total'   => Customer::count(),
                'members' => Customer::where('membership', '!=', 'None')->count(),
            ],
            'pending_kitchen' => Order::whereIn('kitchen_status', ['pending', 'preparing'])->count(),
            'pending_payment' => Order::where('status', 'pending_payment')->count(),
            'low_stock'       => InventoryItem::whereColumn('stock', '<=', 'reorder_level')->count(),
            'top_products'    => $topProducts,
            'sales_trend'     => $trend,
        ]);
    }

    /**
     * GET /api/reports/sales?from=YYYY-MM-DD&to=YYYY-MM-DD
     * Detailed sales report for a date range.
     */
    public function sales(Request $request): JsonResponse
    {
        $from = Carbon::parse($request->query('from', Carbon::now()->subDays(30)->toDateString()))->startOfDay();
        $to   = Carbon::parse($request->query('to',   Carbon::today()->toDateString()))->endOfDay();

        $orders = Order::with('items.product')
            ->whereBetween('created_at', [$from, $to])
            ->get();

        $revenue = (float) $orders->sum('total');
        $cost = 0;
        foreach ($orders as $o) {
            foreach ($o->items as $it) {
                $cost += (float) (optional($it->product)->cost ?? 0) * $it->qty;
            }
        }
        $profit = round($revenue - $cost, 2);
        $tax = (float) $orders->sum('tax');

        // Daily revenue
        $dailyMap = [];
        foreach ($orders as $o) {
            $d = $o->created_at->toDateString();
            $dailyMap[$d] = ($dailyMap[$d] ?? 0) + (float) $o->total;
        }
        ksort($dailyMap);
        $daily = array_map(fn ($d, $v) => ['date' => $d, 'revenue' => round($v, 2)],
            array_keys($dailyMap), array_values($dailyMap));

        // By category
        $byCategory = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('products', 'products.id', '=', 'order_items.product_id')
            ->join('categories', 'categories.id', '=', 'products.category_id')
            ->whereBetween('orders.created_at', [$from, $to])
            ->select('categories.name', DB::raw('SUM(order_items.price * order_items.qty) as revenue'))
            ->groupBy('categories.name')
            ->orderByDesc('revenue')->get();

        // By payment method
        $byPayment = DB::table('payments')
            ->join('orders', 'orders.id', '=', 'payments.order_id')
            ->whereBetween('orders.created_at', [$from, $to])
            ->select('payments.method', DB::raw('SUM(payments.amount) as amount'))
            ->groupBy('payments.method')->get();

        // Top products
        $topProducts = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->whereBetween('orders.created_at', [$from, $to])
            ->select('product_id', 'name', DB::raw('SUM(qty) as units'), DB::raw('SUM(price * qty) as revenue'))
            ->groupBy('product_id', 'name')
            ->orderByDesc('revenue')
            ->limit(10)->get();

        return response()->json([
            'period'       => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'revenue'      => round($revenue, 2),
            'cost'         => round($cost, 2),
            'profit'       => $profit,
            'margin_pct'   => $revenue > 0 ? round(($profit / $revenue) * 100, 1) : 0,
            'tax'          => round($tax, 2),
            'orders'       => $orders->count(),
            'avg_order'    => $orders->count() ? round($revenue / $orders->count(), 2) : 0,
            'daily'        => $daily,
            'by_category'  => $byCategory,
            'by_payment'   => $byPayment,
            'top_products' => $topProducts,
        ]);
    }

    /**
     * GET /api/reports/sales.csv?from=&to=
     * Streams a CSV of orders in the range.
     */
    public function salesCsv(Request $request): StreamedResponse
    {
        $from = Carbon::parse($request->query('from', Carbon::now()->subDays(30)->toDateString()))->startOfDay();
        $to   = Carbon::parse($request->query('to',   Carbon::today()->toDateString()))->endOfDay();

        $filename = "wellness_cafe_sales_{$from->toDateString()}_to_{$to->toDateString()}.csv";

        return response()->streamDownload(function () use ($from, $to) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['OrderNo','Date','Channel','Customer','Items','Subtotal','Discount','Tax','Total','PaymentMethod','Status']);
            Order::with('items', 'payment')
                ->whereBetween('created_at', [$from, $to])
                ->orderBy('created_at')
                ->chunk(500, function ($chunk) use ($out) {
                    foreach ($chunk as $o) {
                        $items = $o->items->map(fn ($i) => "{$i->qty}x {$i->name}")->implode(' | ');
                        fputcsv($out, [
                            $o->order_no, $o->created_at->toIso8601String(), $o->channel,
                            $o->customer_name, $items,
                            $o->subtotal, $o->discount, $o->tax, $o->total,
                            optional($o->payment)->method ?? '-',
                            $o->status,
                        ]);
                    }
                });
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv']);
    }

    /** GET /api/reports/audit?limit=200&action=&user_id= */
    public function audit(Request $request): JsonResponse
    {
        $q = AuditLog::query()->with('user')->latest('created_at');
        if ($a = $request->query('action'))  $q->where('action', $a);
        if ($u = $request->query('user_id')) $q->where('user_id', $u);
        $limit = min(500, (int) $request->query('limit', 200));
        return response()->json($q->limit($limit)->get());
    }
}
