import java.io.*;

public class image_script {
    public static void main(String[] args) throws Exception {
        BufferedReader br = new BufferedReader(new FileReader(new File("./images.txt")));
        BufferedWriter bw = new BufferedWriter(new FileWriter(new File("./image_script.txt")));
        int id=1;
        while (true) {
            String s = br.readLine();
            if (s == null)
                break;
            String updateStatement="UPDATE BUS_COMPANY SET BUS_RELATED_MEDIA='/images/bus/"+s+"' WHERE BUS_COMPANY_ID="+id+";";
            id++;
            bw.write(updateStatement);
            bw.newLine();
        }
        bw.close();
        br.close();
    }
}
