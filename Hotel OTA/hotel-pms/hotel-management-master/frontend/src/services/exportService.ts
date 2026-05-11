import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export interface ExportData {
  properties?: unknown[];
  groups?: unknown[];
  analytics?: unknown[];
  metadata?: {
    exportDate: string;
    exportedBy: string;
    totalRecords: number;
    filters?: Record<string, unknown>;
  };
}

export interface ExportOptions {
  format: 'csv' | 'excel' | 'pdf';
  filename?: string;
  includeAnalytics?: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
  filters?: Record<string, unknown>;
}

class ExportService {
  /**
   * Export data in the specified format
   */
  async exportData(data: ExportData, options: ExportOptions): Promise<void> {
    const filename = options.filename || `export_${new Date().getTime()}`;

    switch (options.format) {
      case 'csv':
        await this.exportToCSV(data, filename);
        break;
      case 'excel':
        await this.exportToExcel(data, filename);
        break;
      case 'pdf':
        await this.exportToPDF(data, filename);
        break;
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  /**
   * Export properties data to CSV
   */
  private async exportToCSV(data: ExportData, filename: string): Promise<void> {
    if (!data.properties || data.properties.length === 0) {
      throw new Error('No property data to export');
    }

    // Flatten property data for CSV export
    const csvData = data.properties.map(property => ({
      'Property ID': property.id || property._id,
      'Property Name': property.name,
      'Brand': property.brand || 'Independent',
      'Type': property.type,
      'City': property.location?.city || property.address?.city,
      'Country': property.location?.country || property.address?.country,
      'Address': property.location?.address || property.address?.street,
      'Phone': property.contact?.phone,
      'Email': property.contact?.email,
      'Total Rooms': property.rooms?.total || property.roomCount || 'N/A',
      'Occupancy Rate (%)': property.performance?.occupancyRate?.toFixed(2) || 'N/A',
      'ADR (₹)': property.performance?.adr?.toFixed(2) || 'N/A',
      'RevPAR (₹)': property.performance?.revpar?.toFixed(2) || 'N/A',
      'Revenue (₹)': property.performance?.revenue?.toLocaleString() || 'N/A',
      'Status': property.status || (property.isActive ? 'Active' : 'Inactive'),
      'Amenities': property.amenities?.join(', ') || 'N/A',
      'Rating': property.rating || 'N/A',
      'Manager': property.contact?.manager || 'N/A'
    }));

    // Convert to CSV string
    const headers = Object.keys(csvData[0]);
    const csvContent = [
      headers.join(','),
      ...csvData.map(row =>
        headers.map(header => {
          const value = row[header as keyof typeof row];
          // Escape commas and quotes in CSV
          return typeof value === 'string' && value.includes(',')
            ? `"${value.replace(/"/g, '""')}"`
            : value;
        }).join(',')
      )
    ].join('\n');

    // Download CSV file
    this.downloadFile(csvContent, `${filename}.csv`, 'text/csv');
  }

  /**
   * Export data to Excel with multiple sheets
   */
  private async exportToExcel(data: ExportData, filename: string): Promise<void> {
    const workbook = XLSX.utils.book_new();

    // Properties Sheet
    if (data.properties && data.properties.length > 0) {
      const propertiesData = data.properties.map(property => ({
        'Property ID': property.id || property._id,
        'Property Name': property.name,
        'Brand': property.brand || 'Independent',
        'Type': property.type,
        'City': property.location?.city || property.address?.city,
        'Country': property.location?.country || property.address?.country,
        'Address': property.location?.address || property.address?.street,
        'State': property.address?.state || 'N/A',
        'ZIP Code': property.address?.zipCode || 'N/A',
        'Phone': property.contact?.phone,
        'Email': property.contact?.email,
        'Website': property.contact?.website || 'N/A',
        'Total Rooms': property.rooms?.total || property.roomCount || 0,
        'Occupied Rooms': property.rooms?.occupied || 0,
        'Available Rooms': property.rooms?.available || 0,
        'Out of Order': property.rooms?.outOfOrder || 0,
        'Occupancy Rate (%)': property.performance?.occupancyRate || 0,
        'ADR (₹)': property.performance?.adr || 0,
        'RevPAR (₹)': property.performance?.revpar || 0,
        'Revenue (₹)': property.performance?.revenue || 0,
        'Last Month Occupancy (%)': property.performance?.lastMonth?.occupancyRate || 0,
        'Last Month ADR (₹)': property.performance?.lastMonth?.adr || 0,
        'Last Month Revenue (₹)': property.performance?.lastMonth?.revenue || 0,
        'Status': property.status || (property.isActive ? 'Active' : 'Inactive'),
        'Rating': property.rating || 0,
        'Manager': property.contact?.manager || 'N/A',
        'Check-in Time': property.operationalHours?.checkIn || 'N/A',
        'Check-out Time': property.operationalHours?.checkOut || 'N/A',
        'Amenities': property.amenities?.join(', ') || 'N/A'
      }));

      const propertiesSheet = XLSX.utils.json_to_sheet(propertiesData);
      XLSX.utils.book_append_sheet(workbook, propertiesSheet, 'Properties');
    }

    // Property Groups Sheet
    if (data.groups && data.groups.length > 0) {
      const groupsData = data.groups.map(group => ({
        'Group ID': group.id || group._id,
        'Group Name': group.name,
        'Description': group.description || 'N/A',
        'Type': group.groupType || group.type || 'N/A',
        'Manager': group.manager || 'N/A',
        'Budget (₹)': group.budget || 0,
        'Properties Count': group.properties?.length || 0,
        'Total Revenue (₹)': group.metrics?.totalRevenue || group.performance?.totalRevenue || 0,
        'Average Occupancy (%)': group.metrics?.avgOccupancy || group.performance?.avgOccupancy || 0,
        'Average ADR (₹)': group.metrics?.avgADR || group.performance?.avgADR || 0,
        'Total Rooms': group.metrics?.totalRooms || 0,
        'Active Properties': group.metrics?.activeProperties || 0,
        'Auto Sync': group.settings?.autoSync ? 'Yes' : 'No',
        'Consolidated Reporting': group.settings?.consolidatedReporting ? 'Yes' : 'No',
        'Shared Inventory': group.settings?.sharedInventory ? 'Yes' : 'No'
      }));

      const groupsSheet = XLSX.utils.json_to_sheet(groupsData);
      XLSX.utils.book_append_sheet(workbook, groupsSheet, 'Property Groups');
    }

    // Analytics Summary Sheet
    if (data.analytics && data.analytics.length > 0) {
      const analyticsSheet = XLSX.utils.json_to_sheet(data.analytics);
      XLSX.utils.book_append_sheet(workbook, analyticsSheet, 'Analytics');
    }

    // Metadata Sheet
    if (data.metadata) {
      const metadataSheet = XLSX.utils.json_to_sheet([data.metadata]);
      XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Export Info');
    }

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    // Download Excel file
    this.downloadBlob(blob, `${filename}.xlsx`);
  }

  /**
   * Export data to PDF report
   */
  private async exportToPDF(data: ExportData, filename: string): Promise<void> {
    const doc = new jsPDF();
    let yPosition = 20;

    // Title
    doc.setFontSize(20);
    doc.text('Multi-Property Management Report', 20, yPosition);
    yPosition += 20;

    // Export metadata
    if (data.metadata) {
      doc.setFontSize(12);
      doc.text(`Export Date: ${data.metadata.exportDate}`, 20, yPosition);
      yPosition += 10;
      doc.text(`Total Records: ${data.metadata.totalRecords}`, 20, yPosition);
      yPosition += 10;
      if (data.metadata.exportedBy) {
        doc.text(`Exported By: ${data.metadata.exportedBy}`, 20, yPosition);
        yPosition += 10;
      }
      yPosition += 10;
    }

    // Properties Summary
    if (data.properties && data.properties.length > 0) {
      doc.setFontSize(16);
      doc.text('Properties Summary', 20, yPosition);
      yPosition += 15;

      // Create properties table
      const propertiesTableData = data.properties.slice(0, 20).map(property => [
        property.name || 'N/A',
        property.type || 'N/A',
        property.location?.city || property.address?.city || 'N/A',
        property.rooms?.total || property.roomCount || 'N/A',
        property.performance?.occupancyRate ? `${property.performance.occupancyRate.toFixed(1)}%` : 'N/A',
        property.performance?.revenue ? `₹${property.performance.revenue.toLocaleString()}` : 'N/A'
      ]);

      (doc as unknown as Record<string, unknown>).autoTable({
        startY: yPosition,
        head: [['Property Name', 'Type', 'City', 'Rooms', 'Occupancy', 'Revenue']],
        body: propertiesTableData,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
        margin: { left: 20, right: 20 }
      });

      yPosition = (doc as unknown as Record<string, unknown>).lastAutoTable.finalY + 20;

      if (data.properties.length > 20) {
        doc.text(`... and ${data.properties.length - 20} more properties`, 20, yPosition);
        yPosition += 15;
      }
    }

    // Property Groups Summary
    if (data.groups && data.groups.length > 0) {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(16);
      doc.text('Property Groups Summary', 20, yPosition);
      yPosition += 15;

      const groupsTableData = data.groups.slice(0, 15).map(group => [
        group.name || 'N/A',
        group.groupType || group.type || 'N/A',
        group.properties?.length || 0,
        group.metrics?.totalRevenue ? `₹${group.metrics.totalRevenue.toLocaleString()}` : 'N/A',
        group.metrics?.avgOccupancy ? `${group.metrics.avgOccupancy.toFixed(1)}%` : 'N/A'
      ]);

      (doc as unknown as Record<string, unknown>).autoTable({
        startY: yPosition,
        head: [['Group Name', 'Type', 'Properties', 'Total Revenue', 'Avg Occupancy']],
        body: groupsTableData,
        theme: 'grid',
        headStyles: { fillColor: [46, 204, 113] },
        margin: { left: 20, right: 20 }
      });
    }

    // Save PDF
    doc.save(`${filename}.pdf`);
  }

  /**
   * Download text content as file
   */
  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    this.downloadBlob(blob, filename);
  }

  /**
   * Download blob as file
   */
  private downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Generate analytics summary for export
   */
  generateAnalyticsSummary(properties: unknown[], groups: unknown[]): unknown[] {
    const totalProperties = properties.length;
    const totalGroups = groups.length;
    const totalRevenue = properties.reduce((sum, p) => sum + (p.performance?.revenue || 0), 0);
    const avgOccupancy = properties.length > 0
      ? properties.reduce((sum, p) => sum + (p.performance?.occupancyRate || 0), 0) / properties.length
      : 0;
    const totalRooms = properties.reduce((sum, p) => sum + (p.rooms?.total || 0), 0);

    return [
      { Metric: 'Total Properties', Value: totalProperties },
      { Metric: 'Total Property Groups', Value: totalGroups },
      { Metric: 'Total Revenue (₹)', Value: totalRevenue.toLocaleString() },
      { Metric: 'Average Occupancy Rate (%)', Value: avgOccupancy.toFixed(2) },
      { Metric: 'Total Rooms', Value: totalRooms },
      { Metric: 'Active Properties', Value: properties.filter(p => p.status === 'active' || p.isActive).length },
      { Metric: 'Export Date', Value: new Date().toLocaleString() }
    ];
  }
}

export const exportService = new ExportService();