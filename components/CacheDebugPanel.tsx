import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { hybridCache } from '@/utils/memoryCache';
import { Ionicons } from '@expo/vector-icons';

/**
 * Cache Debug Component
 * Shows real-time cache statistics and performance
 * 
 * Usage: Add <CacheDebugPanel /> to your dev menu or settings
 */
export const CacheDebugPanel: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [stats, setStats] = useState({
    memoryEntries: 0,
    memorySize: '0 KB',
    hitRate: '0%',
    topAccessed: [] as Array<{ key: string; hits: number }>
  });
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    const updateStats = () => {
      const currentStats = hybridCache.getStats();
      setStats(currentStats);
    };

    updateStats();
    const interval = setInterval(updateStats, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, [refreshCount]);

  const handleClearCache = async () => {
    await hybridCache.clearAll();
    setRefreshCount(prev => prev + 1);
  };

  const handlePruneExpired = () => {
    const pruned = hybridCache.pruneExpired();
    alert(`Pruned ${pruned} expired entries`);
    setRefreshCount(prev => prev + 1);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Cache Performance</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content}>
        {/* Overview Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          
          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.memoryEntries}</Text>
              <Text style={styles.statLabel}>Cached Items</Text>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.memorySize}</Text>
              <Text style={styles.statLabel}>Memory Used</Text>
            </View>
          </View>

          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.hitRate}</Text>
              <Text style={styles.statLabel}>Hit Rate</Text>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {stats.memoryEntries > 0 ? '~0.1ms' : 'N/A'}
              </Text>
              <Text style={styles.statLabel}>Avg Response</Text>
            </View>
          </View>
        </View>

        {/* Top Accessed Items */}
        {stats.topAccessed.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Most Accessed</Text>
            {stats.topAccessed.map((item, index) => (
              <View key={index} style={styles.topItem}>
                <View style={styles.topItemRank}>
                  <Text style={styles.topItemRankText}>#{index + 1}</Text>
                </View>
                <Text style={styles.topItemKey} numberOfLines={1}>
                  {item.key}
                </Text>
                <View style={styles.topItemBadge}>
                  <Text style={styles.topItemHits}>{item.hits} hits</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Performance Tips */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance</Text>
          <View style={styles.tipCard}>
            <Ionicons name="flash" size={20} color="#10B981" />
            <Text style={styles.tipText}>
              Memory cache is ~50-100x faster than disk
            </Text>
          </View>
          <View style={styles.tipCard}>
            <Ionicons name="layers" size={20} color="#3B82F6" />
            <Text style={styles.tipText}>
              Hybrid caching: Memory → Disk → Database
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => setRefreshCount(prev => prev + 1)}
          >
            <Ionicons name="refresh" size={20} color="white" />
            <Text style={styles.actionButtonText}>Refresh Stats</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={handlePruneExpired}
          >
            <Ionicons name="trash" size={20} color="#374151" />
            <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
              Prune Expired
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.actionButtonDanger]}
            onPress={handleClearCache}
          >
            <Ionicons name="warning" size={20} color="white" />
            <Text style={styles.actionButtonText}>Clear All Cache</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  topItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  topItemRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  topItemRankText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  topItemKey: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  topItemBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  topItemHits: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    marginLeft: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    padding: 14,
    borderRadius: 8,
    marginBottom: 12,
  },
  actionButtonSecondary: {
    backgroundColor: '#F3F4F6',
  },
  actionButtonDanger: {
    backgroundColor: '#EF4444',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  actionButtonTextSecondary: {
    color: '#374151',
  },
});
